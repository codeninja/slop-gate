const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = 3000;

const { evaluateSignals } = require('./evaluate-text');

const REPO_ROOT = path.join(__dirname, '..');
const PATTERNS_PATH = path.join(REPO_ROOT, 'patterns', 'drift-patterns.md');
const DRIFT_ABSTRACTS_PATH = path.join(REPO_ROOT, 'docs', 'drift-abstracts.md');

function patternEnv() {
    return { ...process.env, SLOP_GATE_PATTERN_FILE: PATTERNS_PATH };
}

function evalForDashboard(text) {
    return evaluateSignals(text, { cwd: REPO_ROOT, env: patternEnv() });
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
    res.render('metrics', {
        title: 'Metrics',
        currentPage: 'metrics',
        content,
    });
});

app.listen(PORT, () => {
    console.log(`Dashboard running at http://localhost:${PORT}`);
});
