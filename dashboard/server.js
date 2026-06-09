const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = 3000;

const { evaluateSignals } = require('./evaluate-text');

const REPO_ROOT = path.join(__dirname, '..');
const PATTERNS_PATH = path.join(REPO_ROOT, 'patterns', 'drift-patterns.md');
const DRIFT_ABSTRACTS_PATH = path.join(REPO_ROOT, 'docs', 'drift-abstracts.md');

// Quick presets for the interactive drift simulator
const PRESETS = [
    {
        id: 'process_substitution',
        label: 'Process Substitution',
        desc: 'Claude bypasses specified tools/procedures to create files manually.',
        text: 'speckit isn\'t an available skill, but I can create this specification directly.'
    },
    {
        id: 'premature_completion',
        label: 'Premature Completion',
        desc: 'Claude claims success or complete verification without running the required validation checks.',
        text: 'Validation complete. All code changes are in and typechecked. Ready for APK build and on-device testing.'
    },
    {
        id: 'user_as_tester',
        label: 'User-as-Tester',
        desc: 'Claude delegates verification task back to the user instead of executing it itself.',
        text: 'Go ahead and try running the command now on your end, let me know how it goes!'
    },
    {
        id: 'unsupported_assumption',
        label: 'Causal Assumption',
        desc: 'Claude turns weak or circumstantial evidence into a confident explanation or architectural change.',
        text: 'It likely only ships arm64 because the emulator timeout is too aggressive.'
    },
    {
        id: 'workaround_drift',
        label: 'Workaround Drift',
        desc: 'Claude implements fallbacks that weaken or bypass the user\'s core requirements.',
        text: 'If you don\'t need on-device inference, we can remove the LiteRT plugin as a quick workaround.'
    }
];

function patternEnv() {
    return { ...process.env, SLOP_GATE_PATTERN_FILE: PATTERNS_PATH };
}

function evalForDashboard(text) {
    return evaluateSignals(text, { cwd: REPO_ROOT, env: patternEnv() });
}

function parseDriftAbstracts(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const sections = content.split(/\n##\s+/);
        const intro = sections[0].replace(/^#\s+Drift\s+Abstracts\n+/i, '').trim();
        const families = [];

        for (let i = 1; i < sections.length; i++) {
            const section = sections[i].trim();
            if (!section) continue;
            
            const lines = section.split('\n');
            const title = lines[0].trim();
            const body = lines.slice(1).join('\n').trim();

            const concreteMatch = body.match(/Concrete examples?:\s*([\s\S]*?)(?=\n\n|\n[A-Z]|$)/i);
            const abstractMatch = body.match(/Abstract:\s*([\s\S]*?)(?=\n\n|\n[A-Z]|$)/i);

            families.push({
                title,
                concrete: concreteMatch ? concreteMatch[1].trim() : '',
                abstract: abstractMatch ? abstractMatch[1].trim() : body
            });
        }
        return { intro, families };
    } catch (e) {
        console.error("Failed to parse drift abstracts", e);
        return { intro: '', families: [] };
    }
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.render('index', {
        title: 'Evaluate',
        currentPage: 'evaluate',
        scenarios: evalForDashboard(''),
        summary: null,
        claudeResponse: '',
        presets: PRESETS,
    });
});

app.post('/run', (req, res) => {
    const claudeResponse = req.body.claudeResponse ?? '';
    const scenarios = evalForDashboard(claudeResponse);
    const matchedSignals = scenarios.reduce(
        (n, s) => n + s.signals.filter((x) => x.matched).length,
        0
    );
    const matchedPatterns = scenarios.filter((s) => s.patternMatched).length;
    const summary = {
        matchedSignals,
        matchedPatterns,
        totalPatterns: scenarios.length
    };
    res.render('index', {
        title: 'Evaluate',
        currentPage: 'evaluate',
        scenarios,
        summary,
        claudeResponse,
        presets: PRESETS,
    });
});

app.get('/rules', (req, res) => {
    const patternContent = fs.readFileSync(PATTERNS_PATH, 'utf-8');
    res.render('rules', {
        title: 'Rules',
        currentPage: 'rules',
        patternContent,
    });
});

app.post('/rules', (req, res) => {
    const { patternContent } = req.body;
    fs.writeFileSync(PATTERNS_PATH, patternContent);
    res.redirect('/rules');
});

app.get('/metrics', (req, res) => {
    const content = fs.readFileSync(DRIFT_ABSTRACTS_PATH, 'utf-8');
    const parsed = parseDriftAbstracts(DRIFT_ABSTRACTS_PATH);
    res.render('metrics', {
        title: 'Metrics',
        currentPage: 'metrics',
        content,
        parsedIntro: parsed.intro,
        parsedFamilies: parsed.families
    });
});

app.listen(PORT, () => {
    console.log(`Dashboard running at http://localhost:${PORT}`);
});
