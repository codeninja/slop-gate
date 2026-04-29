# Drift Abstracts

These abstractions come from `drift-findings.md`. The hook uses them as pattern
families rather than one-off string checks, so future sessions can be stopped
when they show the same shape of drift with different wording.

## Process substitution

Concrete examples: missing `/speckit`, "skill isn't available, but I can",
"let me just create the file directly".

Abstract: Claude silently replaces the process the user requested with a
manual/direct substitute. The correction challenges whether the missing tool
really authorizes skipping the workflow.

## Premature completion or unverified validation

Concrete examples: "Validation complete", "Fixed and verified", "Work
complete", "Ready for APK build and on-device testing", "PR created".

Abstract: Claude presents work as complete before the requested verification
path has been exercised. The hook suppresses this finding after it records a
validation-like successful tool run, but still challenges unsupported completion
language.

## User-as-tester handoff

Concrete examples: "Go ahead and try", "Please try again", "let me know how it
goes", "No, I haven't".

Abstract: Claude delegates validation back to the user even though validation is
part of the task. The correction asks Claude to run the next observable check or
name the exact blocker.

## Unsupported causal assumption

Concrete examples: "likely only ships arm64", "timeout too aggressive", "should
now have enough time", "Google hasn't released Gemma 4".

Abstract: Claude converts weak evidence into a confident explanation or fix.
The correction requires separating verified evidence from guesses before taking
architecture-changing action.

## Workaround drift

Concrete examples: OCR fallback for Gemma image parsing, removing the LiteRT
plugin, "core functionality we can test", "if you don't need on-device
inference".

Abstract: Claude substitutes a workaround that weakens or bypasses the user's
real requirement. The correction challenges whether the fallback preserves the
original constraints.

## Premature boundary or give-up framing

Concrete examples: "honest boundary", "cannot test", "requires real hardware",
"Start a new session", "none cheap to verify".

Abstract: Claude stops early at a boundary without exhausting local evidence or
naming the next best verification path.

## Tool misuse or stall

Concrete example: `<tool_use_error>Blocked: sleep`.

Abstract: Claude uses a tool pattern that stalls the task. The correction asks
for an alternate observable check instead of waiting or making an unverified
claim.

## Authority or scope overreach

Concrete examples: L2 spec giving L2 authority over L4 creation, "Delegation
Authority Overreach", "spec conflates".

Abstract: Claude expands authority, ownership, or scope beyond what the user
asked for. The correction forces the plan/spec back to the requested boundary.

## Verification path mismatch

Concrete examples: verifying dense/chat path while the user's REPL/vindex path
still fails, using an unrelated tool venv.

Abstract: Claude validates a different runtime path than the one the user asked
to fix. The correction requires evidence from the same user-facing path, runtime,
and inputs.

