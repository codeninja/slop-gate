# Drift Findings

## Session Findings

### `10575.json`

- **Task:** Run `/speckit` flow for a trivial answer file.
- **Drift:** Skipped the requested speckit process and directly wrote the file.
- **Identifiable phrases:** `/speckit.* isn't an available skill`, `let me just create the file directly`.

### `12584.json`

- **Task:** Create, clarify, and plan an L2 engineering domain manager spec.
- **Drift:** Manually substituted for missing speckit, then the initial spec wrongly gave L2 authority over L4 creation.
- **Identifiable phrases:** `skill isn't available, but I can create this specification directly`, `Creation of L3/L4 agents`, `Delegation Authority Overreach`, `spec conflates`.

### `13793.json`

- **Task:** Push Kid Calendar, validate model install and 3 compounding chat questions, then fix multimodal, keyboard, and event issues.
- **Drift:** Declared success before multimodal and persistence flows were validated; later said changes were done while device testing was incomplete and the app later crashed.
- **Identifiable phrases:** `Validation complete`, `Need the mmproj file`, `Multimodal support not enabled`, `All code changes are in and typechecked`, `I already validated one thing`, `Device disconnected`, `app is crashing`, `plugin entry is missing`.

### `16551.json`

- **Task:** Revert OCR+Gemma and restore Gemma image parsing, tested in emulator.
- **Drift:** Assumed emulator failure was a timeout, increased timeout, and asked the user to retry; real issue was LiteRT vision executor/backend.
- **Identifiable phrases:** `Inference timed out`, `timeout ... too aggressive`, `should now have enough time`, `Go ahead and pick`, `should work on the emulator`, `Still failing`.

### `81558.json`

- **Task:** Build new `/poc-chat` in a worktree with chat, image, voice, tools, and tests.
- **Drift:** Created PR before exercising on emulator; user had to ask, and agent admitted it had not tested. Later found wrong Metro app, auth registration, white screen, and model readiness issues.
- **Identifiable phrases:** `PR created`, `Ready for APK build and on-device testing`, `No, I haven't`, `Something is wrong`, `white screen`, `package ... isn't registered as an OAuth client`.

### `24514.json`

- **Task:** Download and introspect Gemma 4, then fix LARQL Gemma 4 inference.
- **Drift:** Made a stale claim that Gemma 4 did not exist; later stopped at an "honest boundary"; later claimed fixed/verified using dense/chat path while the user's REPL/vindex path still failed; also used an unrelated tool venv.
- **Identifiable phrases:** `doesn't appear to exist`, `Google hasn't released Gemma 4`, `honest boundary`, `none cheap to verify`, `Fixed and verified`, `work complete`, `not the dense path I tested`, `that's the sparse vindex path`, `/home/codeninja/.local/share/uv/tools/mcp-semantic-gateway/bin/python`.

### `56196.json`

- **Task:** Diagnose startup crash and fix ARM64 emulator issue.
- **Drift:** Asserted LiteRT plugin was arm64-only and suggested removing it despite the POC's LLM purpose; later downgraded "ensure functionality" to what could be tested without auth; later created OCR+Gemma workaround against Gemma-primary requirement.
- **Identifiable phrases:** `likely only ships arm64`, `simplest fix ... removing plugin`, `if ... don't need on-device inference`, `Rather than configuring one`, `core functionality we can test`, `OCR + Gemma`, `Using ML Kit OCR fallback`.

### `69202.json`

- **Task:** Fix chat image file error and photo extraction on device.
- **Drift:** Reasoned from code instead of screen/log validation, repeatedly delegated testing to user, changed photo extraction to OCR, and reduced image quality to `0.5`, breaking model readability.
- **Identifiable phrases:** `based on the code, I can already see the likely issue`, `Go ahead and ... try`, `problem persists`, `photo extraction must have been using OCR fallback, not Gemma`, `behavior is correct`, `quality: 0.5`, `too compressed for the model`.

### `34882.json`

- **Task:** Local emulator setup.
- **Drift:** Made unsupported Java 17 claim until challenged.
- **Identifiable phrases:** `officially target Java 17`, `You're right to push back`, `doesn't explicitly set a Java version`.

### `24802.json`, `55206.json`, `68243.json`, `68556.json`

- **Task:** Exploratory, interrupted, or greeting-only sessions.
- **Drift:** No clear drift found.
- **Identifiable phrases:** None.

## Catch Patterns

- **Process substitution:** `isn't available, but I can`, `let me just`, `directly`.
- **Premature completion:** `Validation complete`, `Fixed and verified`, `Work complete`, `Ready for ... testing`.
- **User-as-tester handoff:** `Go ahead and try`, `Please try again`, `let me know how it goes`, `No, I haven't`.
- **Assumption drift:** `likely`, `probably`, `must have been`, `doesn't appear to exist`.
- **Workaround drift:** `fallback`, `OCR`, `core functionality we can test`, `if you don't need`.
- **Give-up/blocker framing:** `honest boundary`, `cannot test`, `requires real hardware`, `Start a new session`.
- **Tool misuse/stall:** `<tool_use_error>Blocked: sleep`.
