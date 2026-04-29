"use strict";

function eventText(input) {
  const eventName = input.hook_event_name || "";

  if (eventName === "Stop" || eventName === "SubagentStop") {
    return labelled([
      ["last_assistant_message", input.last_assistant_message],
      ["agent_type", input.agent_type]
    ]);
  }

  if (eventName === "UserPromptSubmit") {
    return labelled([["prompt", input.prompt]]);
  }

  if (eventName === "TaskCreated" || eventName === "TaskCompleted") {
    return labelled([
      ["task_subject", input.task_subject],
      ["task_description", input.task_description],
      ["teammate_name", input.teammate_name],
      ["team_name", input.team_name]
    ]);
  }

  if (eventName === "PostToolBatch") {
    return labelled([["tool_calls", summarizeToolCalls(input.tool_calls)]]);
  }

  if (eventName === "PostToolUseFailure") {
    return labelled([
      ["tool_name", input.tool_name],
      ["tool_input", input.tool_input],
      ["error", input.error],
      ["error_details", input.error_details]
    ]);
  }

  if (eventName === "PreToolUse" || eventName === "PostToolUse") {
    return labelled([
      ["tool_name", input.tool_name],
      ["tool_input", input.tool_input]
    ]);
  }

  return labelled(Object.entries(input));
}

function labelled(entries) {
  return entries
    .map(([label, value]) => {
      const text = stringify(value);
      return text ? `${label}: ${text}` : "";
    })
    .filter(Boolean)
    .join("\n");
}

function stringify(value, depth = 0) {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    if (depth > 3) {
      return "";
    }
    return value.map((item) => stringify(item, depth + 1)).filter(Boolean).join("\n");
  }
  if (typeof value === "object") {
    if (depth > 3) {
      return "";
    }
    return Object.entries(value)
      .map(([key, child]) => {
        const text = stringify(child, depth + 1);
        return text ? `${key}: ${text}` : "";
      })
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

function summarizeToolCalls(toolCalls) {
  if (!Array.isArray(toolCalls)) {
    return "";
  }

  return toolCalls
    .map((call) =>
      labelled([
        ["tool_name", call.tool_name],
        ["tool_input", call.tool_input],
        ["tool_response", responseSnippet(call.tool_response)]
      ])
    )
    .join("\n---\n");
}

function responseSnippet(value) {
  const text = stringify(value);
  return text.slice(0, 2000);
}

function truncate(value, max = 500) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max - 3)}...`;
}

module.exports = {
  eventText,
  stringify,
  truncate
};

