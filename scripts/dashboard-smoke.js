#!/usr/bin/env node
"use strict";

const path = require("path");
const assert = require("node:assert");

const REPO_ROOT = path.join(__dirname, "..");
const PATTERNS_PATH = path.join(REPO_ROOT, "patterns", "drift-patterns.md");
const { evaluateSignals } = require("../dashboard/evaluate-text");

const env = {
    ...process.env,
    SLOP_GATE_PATTERN_FILE: PATTERNS_PATH
};

const sample =
    "Validation complete. All code changes are in and typechecked. Ready for APK build and on-device testing.";

const scenarios = evaluateSignals(sample, { cwd: REPO_ROOT, env });

const premature = scenarios.find((s) => s.id === "premature_completion");
assert(premature, "expected premature_completion scenario from markdown patterns");
assert(premature.patternMatched, "sample text should match premature_completion");
assert(
    premature.signals.some((sig) => sig.matched),
    "at least one signal regex should match"
);

const matchedSignals = scenarios.flatMap((s) => s.signals.filter((x) => x.matched));
assert(matchedSignals.length >= 2, "expected multiple signal hits on sample text");

console.log("dashboard smoke OK:", {
    scenarios: scenarios.length,
    matchedSignals: matchedSignals.length,
    patternHits: scenarios.filter((s) => s.patternMatched).map((s) => s.id)
});
