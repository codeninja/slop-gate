"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const { detectPatterns, isValidationCommand, normalizeText } = require("./patterns");
const { checkPatternRepositoryMutation, isPatternRepositoryToolEvent } = require("./pattern-guard");
const { loadState, saveState } = require("./state");
const { eventText, stringify, truncate } = require("./text");

function handleHook(input, env = process.env) {
  const eventName = input.hook_event_name || "Unknown";
  const state = loadState(input, env);

  hydrateOriginalTaskFromEvent(input, state);
  updateStateBeforeDetection(input, state);

  if (eventName === "UserPromptSubmit") {
    saveState(input, state, env);
    return allow();
  }

  if ((eventName === "Stop" || eventName === "SubagentStop") && input.stop_hook_active) {
    saveState(input, state, env);
    return allow();
  }

  const patternRepoViolation = checkPatternRepositoryMutation(input, state);
  if (patternRepoViolation) {
    const correction = buildCorrectionMessage({ input, state, finding: patternRepoViolation });
    saveState(input, state, env);
    return respondForEvent(eventName, correction, patternRepoViolation);
  }

  if (isPatternRepositoryToolEvent(input)) {
    saveState(input, state, env);
    return allow();
  }

  const findings = detectPatterns(eventText(input), state, { env, cwd: input.cwd });
  const finding = chooseFinding(findings);

  if (!finding) {
    saveState(input, state, env);
    return allow();
  }

  const correction = buildCorrectionMessage({ input, state, finding });
  const correctionKey = hashCorrection(input, finding);

  if (hasRecentCorrection(state, correctionKey)) {
    saveState(input, state, env);
    return allow();
  }

  state.corrections.push({
    key: correctionKey,
    eventName,
    patternId: finding.patternId,
    at: new Date().toISOString(),
    matchedText: finding.matchedText
  });
  saveState(input, state, env);

  return respondForEvent(eventName, correction, finding);
}

function chooseFinding(findings) {
  if (!findings.length) {
    return null;
  }

  const rank = { high: 3, medium: 2, low: 1 };
  return findings
    .slice()
    .sort((a, b) => (rank[b.severity] || 0) - (rank[a.severity] || 0))[0];
}

function hydrateOriginalTaskFromEvent(input, state) {
  if (input.hook_event_name === "UserPromptSubmit" && input.prompt) {
    const prompt = normalizeText(input.prompt);
    if (!state.originalTask) {
      state.originalTask = prompt;
    }
    state.latestUserPrompt = prompt;
    state.prompts.push({ at: new Date().toISOString(), prompt });
    return;
  }

  if (!state.originalTask && input.transcript_path) {
    const fromTranscript = readOriginalTaskFromTranscript(input.transcript_path);
    if (fromTranscript) {
      state.originalTask = fromTranscript;
    }
  }
}

function updateStateBeforeDetection(input, state) {
  if (input.hook_event_name === "PostToolUse" && input.tool_name === "Bash") {
    const command = input.tool_input && input.tool_input.command;
    if (isValidationCommand(command) && toolResponseLooksSuccessful(input.tool_response)) {
      state.validationEvidence.push({
        at: new Date().toISOString(),
        command: truncate(command, 240),
        summary: truncate(stringify(input.tool_response), 300)
      });
    }
  }

  if (input.hook_event_name === "PostToolUseFailure") {
    state.toolFailures.push({
      at: new Date().toISOString(),
      toolName: input.tool_name || "",
      input: truncate(stringify(input.tool_input), 400),
      error: truncate(input.error || input.error_details || "", 400)
    });
  }
}

function toolResponseLooksSuccessful(response) {
  const text = stringify(response).toLowerCase();
  if (!text) {
    return true;
  }
  return !/\b(?:failed|failure|error|exception|traceback|not ok|exited with|exit code [1-9])\b/.test(text);
}

function readOriginalTaskFromTranscript(transcriptPath) {
  try {
    const raw = fs.readFileSync(expandHome(transcriptPath), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      if (!line.trim()) {
        continue;
      }
      const parsed = JSON.parse(line);
      const text = extractUserText(parsed);
      if (text) {
        return normalizeText(text);
      }
    }
  } catch {
    return "";
  }
  return "";
}

function extractUserText(value) {
  if (!value || typeof value !== "object") {
    return "";
  }
  if (value.type === "user" || value.role === "user") {
    return stringify(value.message || value.content || value.text || value);
  }
  if (value.message && value.message.role === "user") {
    return stringify(value.message.content || value.message.text || value.message);
  }
  return "";
}

function expandHome(filePath) {
  if (typeof filePath === "string" && filePath.startsWith("~/")) {
    return `${process.env.HOME || ""}/${filePath.slice(2)}`;
  }
  return filePath;
}

function buildCorrectionMessage({ input, state, finding }) {
  const originalTask = truncate(state.originalTask || state.latestUserPrompt || "Unknown from hook input", 800);
  const latestPrompt =
    state.latestUserPrompt && state.latestUserPrompt !== state.originalTask
      ? `\nLatest user prompt: "${truncate(state.latestUserPrompt, 500)}"`
      : "";
  const evidence = summarizeEvidence(state);

  return [
    "SLOP GATE DRIFT CHECK",
    "",
    `Original task: "${originalTask}"${latestPrompt}`,
    `Event: ${input.hook_event_name || "Unknown"}`,
    `Detected drift pattern: ${finding.title} (${finding.patternId})`,
    `Matched signal: "${truncate(finding.matchedText, 300)}"`,
    "",
    `Assumption being made: ${finding.assumption}`,
    `Challenge: ${finding.challenge}`,
    evidence,
    "",
    "Before continuing, self-reflect and respond to this correction:",
    "1. Restate the user's actual objective and constraints.",
    "2. Name the assumption or drift that triggered this hook.",
    "3. Separate verified evidence from guesses, shortcuts, and untested claims.",
    "4. Decide whether to continue, verify, revise the plan, or ask one focused question.",
    "5. If you continue, take the next concrete step that aligns with the original task."
  ]
    .filter(Boolean)
    .join("\n");
}

function summarizeEvidence(state) {
  const validationCount = state.validationEvidence.length;
  const failureCount = state.toolFailures.length;
  const parts = [];

  if (validationCount) {
    const last = state.validationEvidence[validationCount - 1];
    parts.push(`Recorded validation evidence: ${validationCount} validation-like tool run(s); latest: ${last.command}`);
  } else {
    parts.push("Recorded validation evidence: none in this hook's session state.");
  }

  if (failureCount) {
    const lastFailure = state.toolFailures[failureCount - 1];
    parts.push(`Recent tool failure: ${lastFailure.toolName || "unknown tool"}: ${lastFailure.error || "no error text"}`);
  }

  return parts.join("\n");
}

function respondForEvent(eventName, correction, finding) {
  const summary = buildSummary(eventName, finding);

  if (eventName === "PreToolUse") {
    return json({
      systemMessage: summary,
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: correction
      }
    });
  }

  return json({
    systemMessage: summary,
    hookSpecificOutput: {
      hookEventName: eventName,
      additionalContext: correction
    }
  });
}

function buildSummary(eventName, finding) {
  const headerParts = ["⚠️  Slop Gate"];
  if (finding && finding.patternId) {
    headerParts.push(`pattern=${finding.patternId}`);
  }
  if (finding && finding.severity) {
    headerParts.push(`severity=${finding.severity}`);
  }
  headerParts.push(`event=${eventName}`);

  const lines = [headerParts.join(" | ")];
  if (finding && finding.matchedText) {
    lines.push(`   Caught:     "${truncate(finding.matchedText, 240)}"`);
  }
  if (finding && finding.assumption) {
    lines.push(`   Violation:  ${finding.assumption}`);
  }
  if (finding && finding.challenge) {
    lines.push(`   Mitigation: ${finding.challenge}`);
  }
  return lines.join("\n");
}

function hasRecentCorrection(state, key) {
  return state.corrections.some((correction) => correction.key === key);
}

function hashCorrection(input, finding) {
  const text = `${input.session_id || ""}:${input.hook_event_name || ""}:${finding.patternId}:${
    finding.matchedText || ""
  }`;
  return crypto.createHash("sha256").update(text).digest("hex").slice(0, 20);
}

function allow() {
  return { stdout: "", stderr: "", exitCode: 0 };
}

function json(value) {
  return { stdout: `${JSON.stringify(value)}\n`, stderr: "", exitCode: 0 };
}

async function main() {
  const raw = await readStdin();
  if (!raw.trim()) {
    return;
  }

  let input;
  try {
    input = JSON.parse(raw);
  } catch (error) {
    process.stderr.write(`slop-gate could not parse hook JSON: ${error.message}\n`);
    process.exitCode = 1;
    return;
  }

  const result = handleHook(input, process.env);
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
  process.exitCode = result.exitCode;
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}

module.exports = {
  buildCorrectionMessage,
  handleHook,
  main,
  readOriginalTaskFromTranscript
};
