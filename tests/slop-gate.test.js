"use strict";

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { handleHook } = require("../src/hook");

function tempEnv() {
  return {
    ...process.env,
    SLOP_GATE_STATE_DIR: fs.mkdtempSync(path.join(os.tmpdir(), "slop-gate-test-")),
    SLOP_GATE_PATTERN_FILE: path.join(process.cwd(), "patterns", "drift-patterns.md")
  };
}

function submitPrompt(env, sessionId = "session-1", prompt = "Fix the app and validate it on device") {
  return handleHook(
    {
      session_id: sessionId,
      cwd: process.cwd(),
      hook_event_name: "UserPromptSubmit",
      prompt
    },
    env
  );
}

function parseStdout(result) {
  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, "");
  return JSON.parse(result.stdout);
}

test("Stop surfaces advisory reflection for premature completion", () => {
  const env = tempEnv();
  submitPrompt(env);

  const result = handleHook(
    {
      session_id: "session-1",
      cwd: process.cwd(),
      hook_event_name: "Stop",
      stop_hook_active: false,
      last_assistant_message: "Validation complete. Ready for APK build and on-device testing."
    },
    env
  );

  const output = parseStdout(result);
  assert.equal(output.hookSpecificOutput.hookEventName, "Stop");
  assert.match(output.systemMessage, /^⚠️  Slop Gate \| pattern=premature_completion \| severity=high \| event=Stop$/m);
  assert.match(output.systemMessage, /\n   Caught:\s+"/);
  assert.match(output.systemMessage, /\n   Violation:\s+\S/);
  assert.match(output.systemMessage, /\n   Mitigation:\s+\S/);
  assert.match(output.hookSpecificOutput.additionalContext, /Original task: "Fix the app and validate it on device"/);
  assert.match(output.hookSpecificOutput.additionalContext, /Assumption being made:/);
  assert.match(output.hookSpecificOutput.additionalContext, /Before continuing, self-reflect/);
  assert.match(output.hookSpecificOutput.additionalContext, /premature_completion/);
});

test("validation evidence suppresses premature completion finding", () => {
  const env = tempEnv();
  submitPrompt(env);

  handleHook(
    {
      session_id: "session-1",
      cwd: process.cwd(),
      hook_event_name: "PostToolUse",
      tool_name: "Bash",
      tool_input: { command: "npm test" },
      tool_response: { stdout: "ok 12 tests passed", stderr: "", interrupted: false, isImage: false }
    },
    env
  );

  const result = handleHook(
    {
      session_id: "session-1",
      cwd: process.cwd(),
      hook_event_name: "Stop",
      stop_hook_active: false,
      last_assistant_message: "Validation complete. Work complete."
    },
    env
  );

  assert.deepEqual(result, { stdout: "", stderr: "", exitCode: 0 });
});

test("PreToolUse denies plans that substitute process", () => {
  const env = tempEnv();
  submitPrompt(env, "session-plan", "Run /speckit flow for the answer file");

  const result = handleHook(
    {
      session_id: "session-plan",
      cwd: process.cwd(),
      hook_event_name: "PreToolUse",
      tool_name: "ExitPlanMode",
      tool_input: {
        plan:
          "/speckit isn't an available skill, but I can create this specification directly and continue."
      }
    },
    env
  );

  const output = parseStdout(result);
  assert.equal(output.hookSpecificOutput.hookEventName, "PreToolUse");
  assert.equal(output.hookSpecificOutput.permissionDecision, "deny");
  assert.match(output.hookSpecificOutput.permissionDecisionReason, /process_substitution/);
});

test("PostToolUseFailure injects context for blocked sleep stall", () => {
  const env = tempEnv();
  submitPrompt(env, "session-failure", "Diagnose the failing test without stalling");

  const result = handleHook(
    {
      session_id: "session-failure",
      cwd: process.cwd(),
      hook_event_name: "PostToolUseFailure",
      tool_name: "Bash",
      tool_input: { command: "sleep 60" },
      error: "<tool_use_error>Blocked: sleep"
    },
    env
  );

  const output = parseStdout(result);
  assert.equal(output.hookSpecificOutput.hookEventName, "PostToolUseFailure");
  assert.match(output.hookSpecificOutput.additionalContext, /tool_misuse_stall/);
  assert.match(output.hookSpecificOutput.additionalContext, /Original task:/);
});

test("TaskCompleted surfaces advisory reflection for drift", () => {
  const env = tempEnv();
  submitPrompt(env, "session-task", "Fix multimodal support and validate it");

  const result = handleHook(
    {
      session_id: "session-task",
      cwd: process.cwd(),
      hook_event_name: "TaskCompleted",
      task_id: "task-1",
      task_subject: "Finish validation",
      task_description: "No, I haven't validated this yet. Go ahead and try it."
    },
    env
  );

  const output = parseStdout(result);
  assert.equal(output.hookSpecificOutput.hookEventName, "TaskCompleted");
  assert.match(output.hookSpecificOutput.additionalContext, /user_as_tester/);
  assert.match(output.hookSpecificOutput.additionalContext, /Fix multimodal support and validate it/);
});

test("Stop hook does not loop while stop_hook_active is true", () => {
  const env = tempEnv();
  submitPrompt(env, "session-loop", "Validate before claiming completion");

  const result = handleHook(
    {
      session_id: "session-loop",
      cwd: process.cwd(),
      hook_event_name: "Stop",
      stop_hook_active: true,
      last_assistant_message: "Validation complete. Ready for testing."
    },
    env
  );

  assert.deepEqual(result, { stdout: "", stderr: "", exitCode: 0 });
});

test("hook loads additional patterns from markdown repository", () => {
  const patternDir = fs.mkdtempSync(path.join(os.tmpdir(), "slop-gate-patterns-"));
  const patternFile = path.join(patternDir, "patterns.md");
  fs.writeFileSync(
    patternFile,
    `# Test Patterns

## Pattern: custom_markdown_pattern

Status: active
Severity: high
Requires no validation evidence: false
Title: Custom markdown pattern
Assumption: The response appears to use a custom markdown signal.
Challenge: Reflect on the custom signal before continuing.

### Signals

- \`/custom drift phrase/i\`
`
  );

  const env = {
    ...tempEnv(),
    SLOP_GATE_PATTERN_FILE: patternFile
  };
  submitPrompt(env, "session-markdown", "Catch the custom signal");

  const result = handleHook(
    {
      session_id: "session-markdown",
      cwd: process.cwd(),
      hook_event_name: "Stop",
      stop_hook_active: false,
      last_assistant_message: "This response contains a custom drift phrase."
    },
    env
  );

  const output = parseStdout(result);
  assert.equal(output.hookSpecificOutput.hookEventName, "Stop");
  assert.match(output.hookSpecificOutput.additionalContext, /custom_markdown_pattern/);
});

test("pattern repository edits are append-only without explicit approval", () => {
  const env = tempEnv();
  submitPrompt(env, "session-guard", "Extend the Slop Gate patterns from this mistake");

  const patternFile = path.join(process.cwd(), "patterns", "drift-patterns.md");
  const result = handleHook(
    {
      session_id: "session-guard",
      cwd: process.cwd(),
      hook_event_name: "PreToolUse",
      tool_name: "Edit",
      tool_input: {
        file_path: patternFile,
        old_string: "## Pattern: process_substitution",
        new_string: "## Pattern: process_replacement"
      }
    },
    env
  );

  const output = parseStdout(result);
  assert.equal(output.hookSpecificOutput.permissionDecision, "deny");
  assert.match(output.hookSpecificOutput.permissionDecisionReason, /append-only guard/i);
});

test("pattern repository can be appended without explicit destructive approval", () => {
  const env = tempEnv();
  submitPrompt(env, "session-append", "Extend the Slop Gate patterns from this mistake");

  const patternFile = path.join(process.cwd(), "patterns", "drift-patterns.md");
  const result = handleHook(
    {
      session_id: "session-append",
      cwd: process.cwd(),
      hook_event_name: "PreToolUse",
      tool_name: "Edit",
      tool_input: {
        file_path: patternFile,
        old_string: "### Examples\n\n- `not the dense path I tested`\n- `that's the sparse vindex path`\n",
        new_string:
          "### Examples\n\n- `not the dense path I tested`\n- `that's the sparse vindex path`\n- `new preserved example`\n"
      }
    },
    env
  );

  assert.deepEqual(result, { stdout: "", stderr: "", exitCode: 0 });
});

test("hook executable reads stdin and emits JSON correction", () => {
  const env = tempEnv();
  const prompt = {
    session_id: "session-cli",
    cwd: process.cwd(),
    hook_event_name: "UserPromptSubmit",
    prompt: "Validate before claiming completion"
  };
  spawnSync(path.join(process.cwd(), "bin", "slop-gate-hook"), {
    input: JSON.stringify(prompt),
    encoding: "utf8",
    env
  });

  const result = spawnSync(path.join(process.cwd(), "bin", "slop-gate-hook"), {
    input: JSON.stringify({
      session_id: "session-cli",
      cwd: process.cwd(),
      hook_event_name: "Stop",
      stop_hook_active: false,
      last_assistant_message: "Validation complete."
    }),
    encoding: "utf8",
    env
  });

  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  const output = JSON.parse(result.stdout);
  assert.equal(output.hookSpecificOutput.hookEventName, "Stop");
  assert.match(output.hookSpecificOutput.additionalContext, /premature_completion/);
});

test("history audit extracts candidate drift episodes from Claude transcripts", () => {
  const transcriptDir = fs.mkdtempSync(path.join(os.tmpdir(), "slop-gate-history-"));
  const transcriptPath = path.join(transcriptDir, "session.jsonl");
  const outputPath = path.join(transcriptDir, "audit.md");
  fs.writeFileSync(
    transcriptPath,
    [
      {
        type: "user",
        session_id: "session-history",
        message: {
          role: "user",
          content: [{ type: "text", text: "Fix the app and validate it on device" }]
        }
      },
      {
        type: "assistant",
        session_id: "session-history",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "Validation complete. Ready for device testing." }]
        }
      }
    ]
      .map((line) => JSON.stringify(line))
      .join("\n")
  );

  const result = spawnSync(
    process.execPath,
    [
      path.join(process.cwd(), "scripts", "audit-claude-history.js"),
      "--root",
      transcriptDir,
      "--out",
      outputPath,
      "--limit",
      "10"
    ],
    { encoding: "utf8" }
  );

  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /audit\.md/);

  const output = fs.readFileSync(outputPath, "utf8");
  assert.match(output, /premature_completion/);
  assert.match(output, /Fix the app and validate it on device/);
  assert.match(output, /Validation complete\. Ready for device testing\./);
});
