"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { truncate } = require("./text");

function checkPatternRepositoryMutation(input, state) {
  if (input.hook_event_name !== "PreToolUse") {
    return null;
  }

  const toolName = input.tool_name || "";
  const toolInput = input.tool_input || {};
  const approval = hasDestructivePatternApproval(state);

  if (toolName === "Write") {
    return checkWrite(toolInput, approval);
  }

  if (toolName === "Edit") {
    return checkEdit(toolInput, approval);
  }

  if (toolName === "MultiEdit") {
    return checkMultiEdit(toolInput, approval);
  }

  if (toolName === "Bash") {
    return checkBash(toolInput, approval);
  }

  return null;
}

function isPatternRepositoryToolEvent(input) {
  if (!input || input.hook_event_name !== "PreToolUse") {
    return false;
  }

  const toolName = input.tool_name || "";
  const toolInput = input.tool_input || {};

  if (toolName === "Write" || toolName === "Edit" || toolName === "MultiEdit") {
    return isProtectedPatternPath(toolInput.file_path);
  }

  if (toolName === "Bash") {
    return mentionsPatternRepository(String(toolInput.command || ""));
  }

  return false;
}

function checkWrite(toolInput, approval) {
  const filePath = toolInput.file_path;
  if (!isProtectedPatternPath(filePath)) {
    return null;
  }

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const current = safeRead(filePath);
  const next = String(toolInput.content || "");
  if (approval || next.startsWith(current) || next.includes(current)) {
    return null;
  }

  return violation(
    filePath,
    "Write would overwrite an existing pattern repository file instead of preserving the previous content."
  );
}

function checkEdit(toolInput, approval) {
  const filePath = toolInput.file_path;
  if (!isProtectedPatternPath(filePath) || approval) {
    return null;
  }

  const oldString = String(toolInput.old_string || "");
  const newString = String(toolInput.new_string || "");
  if (!oldString || newString.includes(oldString)) {
    return null;
  }

  return violation(
    filePath,
    "Edit would replace pattern repository text without preserving the original matched text."
  );
}

function checkMultiEdit(toolInput, approval) {
  const filePath = toolInput.file_path;
  if (!isProtectedPatternPath(filePath) || approval) {
    return null;
  }

  const edits = Array.isArray(toolInput.edits) ? toolInput.edits : [];
  for (const edit of edits) {
    const oldString = String(edit.old_string || "");
    const newString = String(edit.new_string || "");
    if (oldString && !newString.includes(oldString)) {
      return violation(
        filePath,
        "MultiEdit would replace pattern repository text without preserving one of the original matched strings."
      );
    }
  }

  return null;
}

function checkBash(toolInput, approval) {
  const command = String(toolInput.command || "");
  if (approval || !mentionsPatternRepository(command) || !looksLikeShellMutation(command)) {
    return null;
  }

  return violation(
    "patterns/",
    `Bash command appears to mutate the pattern repository outside the append-only editor path: ${truncate(command, 220)}`
  );
}

function isProtectedPatternPath(filePath) {
  if (!filePath) {
    return false;
  }

  const normalized = path.normalize(String(filePath));
  return /(^|[/\\])patterns[/\\].+\.md$/i.test(normalized);
}

function mentionsPatternRepository(command) {
  return /(^|\s|["'])\.?\/?patterns\/.+\.md\b/i.test(command) || /\bpatterns\//i.test(command);
}

function looksLikeShellMutation(command) {
  return /\b(?:rm|mv|cp|truncate)\b|\b(?:sed|perl)\s+[^|;&]*-(?:i|pi)\b|(?:^|[^>\d])>\s*[^&]|\btee\b/i.test(
    command
  );
}

function hasDestructivePatternApproval(state) {
  const prompt = `${state.latestUserPrompt || ""}\n${(state.prompts || [])
    .map((entry) => entry.prompt || "")
    .slice(-3)
    .join("\n")}`;
  return (
    /\b(?:approve|approved|allow|allowed|authorize|authorized|permission|ok|okay)\b.{0,120}\b(?:remove|delete|rewrite|replace|rename|reorder|prune|overwrite)\b.{0,120}\bpatterns?\b/i.test(
      prompt
    ) ||
    /\b(?:remove|delete|rewrite|replace|rename|reorder|prune|overwrite)\b.{0,120}\bpatterns?\b.{0,120}\b(?:approve|approved|allow|allowed|authorize|authorized|permission|ok|okay)\b/i.test(
      prompt
    )
  );
}

function safeRead(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function violation(filePath, reason) {
  return {
    patternId: "pattern_repository_append_only",
    title: "Pattern repository append-only guard",
    severity: "high",
    matchedText: truncate(reason, 220),
    assumption:
      "The action appears to remove, rewrite, reorder, or overwrite existing Slop Gate pattern knowledge.",
    challenge:
      "Pattern memory should be append-only unless the user explicitly approves destructive maintenance.",
    filePath,
    reason
  };
}

module.exports = {
  checkPatternRepositoryMutation,
  hasDestructivePatternApproval,
  isPatternRepositoryToolEvent,
  isProtectedPatternPath
};
