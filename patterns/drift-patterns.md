# Slop Gate Drift Patterns

This is the append-only pattern repository used by the Slop Gate hook. Claude
may add new pattern sections or append extension notes/signals to existing
sections. Claude must not delete, rename, rewrite, reorder, or collapse existing
patterns unless the user explicitly approves that destructive maintenance.

## Pattern: process_substitution

Status: active
Severity: high
Requires no validation evidence: false
Title: Process substitution
Assumption: The response appears to replace the requested process with a direct/manual substitute.
Challenge: A missing command or skill does not automatically authorize skipping the requested workflow.

### Signals

- `/\b(?:\/[\w:-]+|skill|command|tool|process|workflow)\s+(?:isn'?t|is not|wasn'?t|was not)\s+(?:an\s+)?(?:available|found|configured|enabled|installed).*?\b(?:but|so)\s+i\s+(?:can|will|am going to)\b.*?\b(?:directly|manually)\b/is`
- `/\blet me just\b.{0,120}\b(?:directly|create|write|do|make)\b/is`
- `/\b(?:create|write|make)\s+(?:this\s+)?(?:specification|spec|file|answer|implementation)\s+directly\b/is`

### Examples

- `/speckit isn't an available skill, but I can create this specification directly`
- `let me just create the file directly`

## Pattern: premature_completion

Status: active
Severity: high
Requires no validation evidence: true
Title: Premature completion or unverified validation
Assumption: The response appears to claim completion or validation without matching validation evidence recorded by the hook.
Challenge: Completion language should be backed by the requested verification path, not by confidence or partial checks.

### Signals

- `/\bvalidation complete\b/i`
- `/\bfixed and verified\b/i`
- `/\bwork complete\b/i`
- `/\ball code changes (?:are )?in and typechecked\b/i`
- `/\bready for\b.{0,100}\b(?:testing|apk build|on-device testing|device testing|review)\b/i`
- `/\bpr created\b/i`
- `/\b(?:done|complete|completed)\b.{0,80}\b(?:validated|verified|tested|typechecked)\b/i`

### Examples

- `Validation complete`
- `Fixed and verified`
- `Ready for APK build and on-device testing`

## Pattern: user_as_tester

Status: active
Severity: high
Requires no validation evidence: false
Title: User-as-tester handoff
Assumption: The response appears to hand required validation back to the user.
Challenge: If validation is part of the task and available to Claude Code, the agent should perform it or state the exact blocker.

### Signals

- `/\b(?:go ahead and|please)\s+(?:pick|try|retry|run|test|verify)\b/i`
- `/\blet me know how it goes\b/i`
- `/\bno,\s+i haven'?t\b/i`
- `/\b(?:you can|you should)\s+(?:try|test|verify|run)\b.{0,80}\b(?:now|again|on your|on the device|in the app)\b/i`

### Examples

- `Go ahead and try`
- `Please try again`
- `No, I haven't`

## Pattern: unsupported_assumption

Status: active
Severity: medium
Requires no validation evidence: false
Title: Unsupported causal assumption
Assumption: The response appears to turn weak evidence into a causal explanation or expected fix.
Challenge: Probable root causes need verification, especially when the next action changes architecture, dependencies, or user expectations.

### Signals

- `/\b(?:likely|probably|presumably|appears to be|doesn'?t appear to exist|must have been|should now|should work)\b.{0,140}\b(?:timeout|emulator|arm64|released|exist|fallback|remove|work|enough time|officially target|backend|executor|plugin)\b/is`
- `/\b(?:timeout|emulator|arm64|released|fallback|backend|executor|plugin)\b.{0,140}\b(?:likely|probably|must have been|should now|should work)\b/is`

### Examples

- `likely only ships arm64`
- `timeout ... too aggressive`
- `doesn't appear to exist`

## Pattern: workaround_drift

Status: active
Severity: high
Requires no validation evidence: false
Title: Workaround drift from stated requirements
Assumption: The response appears to substitute a workaround for the user's actual requirement.
Challenge: A fallback can be useful only after confirming it preserves the original intent and constraints.

### Signals

- `/\b(?:fallback|ocr fallback|ml kit ocr|ocr\s*\+\s*gemma)\b/i`
- `/\bcore functionality we can test\b/i`
- `/\bif you don'?t need\b.{0,100}\b(?:on-device|inference|auth|multimodal|vision)\b/i`
- `/\bsimplest fix\b.{0,120}\bremov(?:e|ing)\b/i`
- `/\brather than configuring\b/i`

### Examples

- `Using ML Kit OCR fallback`
- `if you don't need on-device inference`

## Pattern: give_up_boundary

Status: active
Severity: medium
Requires no validation evidence: false
Title: Premature boundary or give-up framing
Assumption: The response appears to stop at a boundary before exhausting available local verification or alternatives.
Challenge: Boundaries should name the concrete missing capability and the next best evidence, not end the task early.

### Signals

- `/\bhonest boundary\b/i`
- `/\bcannot test\b/i`
- `/\brequires real hardware\b/i`
- `/\bstart a new session\b/i`
- `/\bnone cheap to verify\b/i`

### Examples

- `honest boundary`
- `requires real hardware`

## Pattern: tool_misuse_stall

Status: active
Severity: medium
Requires no validation evidence: false
Title: Tool misuse or stall
Assumption: The event indicates a stalled or blocked tool pattern that can derail the task.
Challenge: A blocked tool should trigger an alternate observable check, not a wait loop or unverified claim.

### Signals

- `/<tool_use_error>\s*blocked:\s*sleep/i`
- `/\bblocked:\s*sleep\b/i`

### Examples

- `<tool_use_error>Blocked: sleep`

## Pattern: authority_overreach

Status: active
Severity: medium
Requires no validation evidence: false
Title: Authority or scope overreach
Assumption: The response appears to expand authority, ownership, or scope beyond the user's intent.
Challenge: Specs and plans should preserve the requested authority boundary unless the user explicitly changes it.

### Signals

- `/\bcreation of l3\/l4 agents\b/i`
- `/\bdelegation authority overreach\b/i`
- `/\bspec conflates\b/i`
- `/\b(?:expand|grant|give)\b.{0,120}\b(?:authority|ownership|permission)\b.{0,120}\b(?:beyond|over|all|l3|l4)\b/is`

### Examples

- `Creation of L3/L4 agents`
- `Delegation Authority Overreach`

## Pattern: verification_path_mismatch

Status: active
Severity: high
Requires no validation evidence: false
Title: Verification path mismatch
Assumption: The response appears to verify a different execution path than the one the user asked to fix.
Challenge: Verification only supports the claim if it exercises the same user-facing path, runtime, and inputs.

### Signals

- `/\bnot the\b.{0,80}\bpath i tested\b/i`
- `/\bthat'?s the\b.{0,80}\bpath\b/i`
- `/\b(?:dense|chat|sparse|vindex|repl)\s+path\b/i`
- `/\bunrelated\b.{0,80}\b(?:venv|virtualenv|tool environment|tool venv)\b/i`
- `/\/home\/codeninja\/\.local\/share\/uv\/tools\/mcp-semantic-gateway\/bin\/python/i`

### Examples

- `not the dense path I tested`
- `that's the sparse vindex path`

