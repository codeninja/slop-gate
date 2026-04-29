"use strict";

const fs = require("node:fs");

const file = process.argv[2];
const prompt = process.argv[3] || "";

if (!file) {
  console.error("Usage: node scripts/render-e2e-claude-output.js <stream-jsonl> [prompt]");
  process.exit(1);
}

const { events, nonJsonLines } = readStreamEvents(file);
const serialized = JSON.stringify(events);
const correctionIndex = events.findIndex((event) =>
  JSON.stringify(event).includes("SLOP GATE DRIFT CHECK")
);
const correction = normalizeHookPayload(findStringContaining(events, "SLOP GATE DRIFT CHECK"));
const assistantOutputs = collectAssistantOutputs(events);
const assistantAfterCorrection =
  correctionIndex >= 0 ? collectAssistantOutputs(events.slice(correctionIndex + 1)) : [];
const promptHookFeedback = collectPromptHookFeedback(events);

const checks = [
  ["Claude stream emitted events", events.length > 0],
  ["Slop Gate correction reached Claude stream", Boolean(correction)],
  ["Prompt-based Stop hook reached Claude stream", promptHookFeedback.length > 0],
  ["premature_completion finding is visible", serialized.includes("premature_completion")],
  ["Stop hook returned a block decision", hasStopBlockDecision(serialized)]
];

printSection("CLAUDE INPUT", prompt);
printSection(
  "CLAUDE OUTPUT",
  assistantOutputs.length ? assistantOutputs.join("\n\n---\n\n") : "(no assistant text found in stream-json output)"
);
printSection("SLOP GATE OUTPUT DELIVERED TO CLAUDE", correction || "(no Slop Gate correction found)");
printSection(
  "PROMPT HOOK OUTPUT DELIVERED TO CLAUDE",
  promptHookFeedback.length ? promptHookFeedback.join("\n\n---\n\n") : "(no prompt hook feedback found)"
);

if (assistantAfterCorrection.length) {
  printSection("CLAUDE OUTPUT AFTER SLOP GATE", assistantAfterCorrection.join("\n\n---\n\n"));
}

if (nonJsonLines.length) {
  printSection("NON-JSON STREAM LINES", nonJsonLines.join("\n"));
}

console.log("\nEFFECT CHECK");
for (const [label, passed] of checks) {
  console.log(`${passed ? "[PASS]" : "[FAIL]"} ${label}`);
}
console.log(
  `${assistantAfterCorrection.length ? "[PASS]" : "[INFO]"} Claude emitted assistant text after the Slop Gate block`
);

if (checks.some(([, passed]) => !passed)) {
  process.exit(1);
}

function readStreamEvents(streamPath) {
  const lines = fs.readFileSync(streamPath, "utf8").trim().split(/\r?\n/).filter(Boolean);
  const parsedEvents = [];
  const rawLines = [];

  for (const line of lines) {
    try {
      parsedEvents.push(JSON.parse(line));
    } catch {
      rawLines.push(line);
    }
  }

  return { events: parsedEvents, nonJsonLines: rawLines };
}

function collectAssistantOutputs(values) {
  const outputs = [];
  for (const event of values) {
    addUnique(outputs, assistantTextFromEvent(event));
    if (event && event.type === "result" && typeof event.result === "string") {
      addUnique(outputs, event.result);
    }
  }
  return outputs.map((text) => text.trim()).filter(Boolean);
}

function collectPromptHookFeedback(values) {
  const outputs = [];
  for (const event of values) {
    if (!event || event.type !== "user" || !event.isSynthetic) {
      continue;
    }

    const text = messageText(event.message || event);
    if (!/^Stop hook feedback:\n/.test(text) && !/^SubagentStop hook feedback:\n/.test(text)) {
      continue;
    }
    if (text.includes("SLOP GATE DRIFT CHECK")) {
      continue;
    }

    addUnique(outputs, formatPromptHookFeedback(text));
  }
  return outputs;
}

function assistantTextFromEvent(event) {
  if (!event || typeof event !== "object") {
    return "";
  }

  if (event.type === "assistant") {
    return messageText(event.message || event);
  }

  if (event.role === "assistant" || (event.message && event.message.role === "assistant")) {
    return messageText(event.message || event);
  }

  return "";
}

function messageText(message) {
  if (!message || typeof message !== "object") {
    return typeof message === "string" ? message : "";
  }

  if (typeof message.text === "string") {
    return message.text;
  }

  if (typeof message.content === "string") {
    return message.content;
  }

  if (Array.isArray(message.content)) {
    return message.content
      .map((item) => {
        if (!item || typeof item !== "object") {
          return typeof item === "string" ? item : "";
        }
        return typeof item.text === "string" ? item.text : "";
      })
      .filter(Boolean)
      .join("\n");
  }

  return "";
}

function formatPromptHookFeedback(text) {
  const stripped = text.replace(/^(?:Stop|SubagentStop) hook feedback:\n/, "");
  const match = /^\[([^\]]+)\]:\s*([\s\S]+)$/.exec(stripped);
  if (!match) {
    return stripped;
  }
  return `Condition: ${match[1]}\nReason: ${match[2]}`;
}

function findStringContaining(value, needle) {
  if (typeof value === "string") {
    return value.includes(needle) ? value : "";
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findStringContaining(item, needle);
      if (found) {
        return found;
      }
    }
    return "";
  }

  if (value && typeof value === "object") {
    for (const child of Object.values(value)) {
      const found = findStringContaining(child, needle);
      if (found) {
        return found;
      }
    }
  }

  return "";
}

function normalizeHookPayload(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) {
    return "";
  }

  try {
    const parsed = JSON.parse(trimmed);
    return (
      parsed.reason ||
      parsed.hookSpecificOutput?.permissionDecisionReason ||
      parsed.hookSpecificOutput?.additionalContext ||
      trimmed
    );
  } catch {
    return trimmed;
  }
}

function hasStopBlockDecision(serialized) {
  return serialized.includes('\\"decision\\":\\"block\\"') || serialized.includes('"decision":"block"');
}

function addUnique(values, value) {
  const text = String(value || "").trim();
  if (text && !values.includes(text)) {
    values.push(text);
  }
}

function printSection(title, body) {
  console.log(`\n=== ${title} ===`);
  console.log(body);
}
