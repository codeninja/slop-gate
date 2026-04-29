"use strict";

const { loadMarkdownPatterns } = require("./pattern-repository");

const VALIDATION_COMMAND_RE =
  /\b(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?(?:test|typecheck|lint|check|verify)\b|\b(?:pytest|go\s+test|cargo\s+test|swift\s+test|xcodebuild|gradle(?:w)?\s+(?:test|connected|check)|adb|emulator|detox|maestro|tsc|vitest|jest|playwright|cypress)\b/i;

const BUILTIN_PATTERNS = [
  {
    id: "process_substitution",
    title: "Process substitution",
    severity: "high",
    regexes: [
      /\b(?:\/[\w:-]+|skill|command|tool|process|workflow)\s+(?:isn'?t|is not|wasn'?t|was not)\s+(?:an\s+)?(?:available|found|configured|enabled|installed).*?\b(?:but|so)\s+i\s+(?:can|will|am going to)\b.*?\b(?:directly|manually)\b/is,
      /\blet me just\b.{0,120}\b(?:directly|create|write|do|make)\b/is,
      /\b(?:create|write|make)\s+(?:this\s+)?(?:specification|spec|file|answer|implementation)\s+directly\b/is
    ],
    assumption:
      "The response appears to replace the requested process with a direct/manual substitute.",
    challenge:
      "A missing command or skill does not automatically authorize skipping the requested workflow."
  },
  {
    id: "premature_completion",
    title: "Premature completion or unverified validation",
    severity: "high",
    requiresNoValidationEvidence: true,
    regexes: [
      /\bvalidation complete\b/i,
      /\bfixed and verified\b/i,
      /\bwork complete\b/i,
      /\ball code changes (?:are )?in and typechecked\b/i,
      /\bready for\b.{0,100}\b(?:testing|apk build|on-device testing|device testing|review)\b/i,
      /\bpr created\b/i,
      /\b(?:done|complete|completed)\b.{0,80}\b(?:validated|verified|tested|typechecked)\b/i
    ],
    assumption:
      "The response appears to claim completion or validation without matching validation evidence recorded by the hook.",
    challenge:
      "Completion language should be backed by the requested verification path, not by confidence or partial checks."
  },
  {
    id: "user_as_tester",
    title: "User-as-tester handoff",
    severity: "high",
    regexes: [
      /\b(?:go ahead and|please)\s+(?:pick|try|retry|run|test|verify)\b/i,
      /\blet me know how it goes\b/i,
      /\bno,\s+i haven'?t\b/i,
      /\b(?:you can|you should)\s+(?:try|test|verify|run)\b.{0,80}\b(?:now|again|on your|on the device|in the app)\b/i
    ],
    assumption:
      "The response appears to hand required validation back to the user.",
    challenge:
      "If validation is part of the task and available to Claude Code, the agent should perform it or state the exact blocker."
  },
  {
    id: "unsupported_assumption",
    title: "Unsupported causal assumption",
    severity: "medium",
    regexes: [
      /\b(?:likely|probably|presumably|appears to be|doesn'?t appear to exist|must have been|should now|should work)\b.{0,140}\b(?:timeout|emulator|arm64|released|exist|fallback|remove|work|enough time|officially target|backend|executor|plugin)\b/is,
      /\b(?:timeout|emulator|arm64|released|fallback|backend|executor|plugin)\b.{0,140}\b(?:likely|probably|must have been|should now|should work)\b/is
    ],
    assumption:
      "The response appears to turn weak evidence into a causal explanation or expected fix.",
    challenge:
      "Probable root causes need verification, especially when the next action changes architecture, dependencies, or user expectations."
  },
  {
    id: "workaround_drift",
    title: "Workaround drift from stated requirements",
    severity: "high",
    regexes: [
      /\b(?:fallback|ocr fallback|ml kit ocr|ocr\s*\+\s*gemma)\b/i,
      /\bcore functionality we can test\b/i,
      /\bif you don'?t need\b.{0,100}\b(?:on-device|inference|auth|multimodal|vision)\b/i,
      /\bsimplest fix\b.{0,120}\bremov(?:e|ing)\b/i,
      /\brather than configuring\b/i
    ],
    assumption:
      "The response appears to substitute a workaround for the user's actual requirement.",
    challenge:
      "A fallback can be useful only after confirming it preserves the original intent and constraints."
  },
  {
    id: "give_up_boundary",
    title: "Premature boundary or give-up framing",
    severity: "medium",
    regexes: [
      /\bhonest boundary\b/i,
      /\bcannot test\b/i,
      /\brequires real hardware\b/i,
      /\bstart a new session\b/i,
      /\bnone cheap to verify\b/i
    ],
    assumption:
      "The response appears to stop at a boundary before exhausting available local verification or alternatives.",
    challenge:
      "Boundaries should name the concrete missing capability and the next best evidence, not end the task early."
  },
  {
    id: "tool_misuse_stall",
    title: "Tool misuse or stall",
    severity: "medium",
    regexes: [
      /<tool_use_error>\s*blocked:\s*sleep/i,
      /\bblocked:\s*sleep\b/i
    ],
    assumption:
      "The event indicates a stalled or blocked tool pattern that can derail the task.",
    challenge:
      "A blocked tool should trigger an alternate observable check, not a wait loop or unverified claim."
  },
  {
    id: "authority_overreach",
    title: "Authority or scope overreach",
    severity: "medium",
    regexes: [
      /\bcreation of l3\/l4 agents\b/i,
      /\bdelegation authority overreach\b/i,
      /\bspec conflates\b/i,
      /\b(?:expand|grant|give)\b.{0,120}\b(?:authority|ownership|permission)\b.{0,120}\b(?:beyond|over|all|l3|l4)\b/is
    ],
    assumption:
      "The response appears to expand authority, ownership, or scope beyond the user's intent.",
    challenge:
      "Specs and plans should preserve the requested authority boundary unless the user explicitly changes it."
  },
  {
    id: "verification_path_mismatch",
    title: "Verification path mismatch",
    severity: "high",
    regexes: [
      /\bnot the\b.{0,80}\bpath i tested\b/i,
      /\bthat'?s the\b.{0,80}\bpath\b/i,
      /\b(?:dense|chat|sparse|vindex|repl)\s+path\b/i,
      /\bunrelated\b.{0,80}\b(?:venv|virtualenv|tool environment|tool venv)\b/i,
      /\/home\/codeninja\/\.local\/share\/uv\/tools\/mcp-semantic-gateway\/bin\/python/i
    ],
    assumption:
      "The response appears to verify a different execution path than the one the user asked to fix.",
    challenge:
      "Verification only supports the claim if it exercises the same user-facing path, runtime, and inputs."
  }
];

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function matchPattern(pattern, text, state) {
  if (pattern.requiresNoValidationEvidence && hasValidationEvidence(state)) {
    return null;
  }

  for (const regex of pattern.regexes) {
    const match = regex.exec(text);
    if (match) {
      return {
        patternId: pattern.id,
        title: pattern.title,
        severity: pattern.severity,
        assumption: pattern.assumption,
        challenge: pattern.challenge,
        matchedText: normalizeText(match[0]).slice(0, 220)
      };
    }
  }

  return null;
}

function detectPatterns(text, state, options = {}) {
  const normalized = normalizeText(text);
  if (!normalized) {
    return [];
  }

  return getPatterns(options).map((pattern) => matchPattern(pattern, normalized, state)).filter(Boolean);
}

function getPatterns(options = {}) {
  const env = options.env || process.env;
  const cwd = options.cwd || process.cwd();
  const markdownPatterns = loadMarkdownPatterns(env, cwd);
  return markdownPatterns.length ? markdownPatterns : BUILTIN_PATTERNS;
}

function hasValidationEvidence(state) {
  return Boolean(state && Array.isArray(state.validationEvidence) && state.validationEvidence.length > 0);
}

function isValidationCommand(command) {
  return VALIDATION_COMMAND_RE.test(String(command || ""));
}

module.exports = {
  BUILTIN_PATTERNS,
  detectPatterns,
  getPatterns,
  hasValidationEvidence,
  isValidationCommand,
  normalizeText
};
