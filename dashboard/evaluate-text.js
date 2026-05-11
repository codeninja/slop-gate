"use strict";

const path = require("path");
const { getPatterns, normalizeText, hasValidationEvidence } = require("../src/patterns");

function regexDisplay(regex) {
    return `/${regex.source}/${regex.flags}`;
}

function patternExamples(pattern) {
    return Array.isArray(pattern.examples) ? pattern.examples : [];
}

/**
 * Evaluate pasted assistant text against every signal regex in drift-patterns.md
 * (same pattern objects the hook uses). Each signal is checked independently.
 *
 * @param {string} text
 * @param {{ cwd?: string, env?: object, state?: object }} [options]
 */
function evaluateSignals(text, options = {}) {
    const cwd = options.cwd || path.join(__dirname, "..");
    const env = options.env || process.env;
    const state = options.state || { validationEvidence: [], toolFailures: [] };

    const patterns = getPatterns({ env, cwd });
    const normalized = normalizeText(text);

    return patterns.map((pattern) => {
        const skippedDueToValidation =
            Boolean(pattern.requiresNoValidationEvidence) && hasValidationEvidence(state);

        if (!normalized || skippedDueToValidation) {
            return {
                id: pattern.id,
                title: pattern.title,
                severity: pattern.severity,
                requiresNoValidationEvidence: Boolean(pattern.requiresNoValidationEvidence),
                skippedDueToValidation,
                patternMatched: false,
                examples: patternExamples(pattern),
                signals: pattern.regexes.map((regex) => ({
                    display: regexDisplay(regex),
                    matched: false,
                    matchedText: "",
                    skipped: skippedDueToValidation
                }))
            };
        }

        let patternMatched = false;
        const signals = [];

        for (const regex of pattern.regexes) {
            regex.lastIndex = 0;
            const match = regex.exec(normalized);
            const matched = Boolean(match);
            const matchedText = matched ? normalizeText(match[0]).slice(0, 220) : "";
            if (matched) {
                patternMatched = true;
            }
            signals.push({
                display: regexDisplay(regex),
                matched,
                matchedText,
                skipped: false
            });
        }

        return {
            id: pattern.id,
            title: pattern.title,
            severity: pattern.severity,
            requiresNoValidationEvidence: Boolean(pattern.requiresNoValidationEvidence),
            skippedDueToValidation: false,
            patternMatched,
            examples: patternExamples(pattern),
            signals
        };
    });
}

module.exports = {
    evaluateSignals,
    regexDisplay
};
