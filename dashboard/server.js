const express = require('express');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');

app.get('/', (req, res) => {
    const patternContent = fs.readFileSync('../patterns/drift-patterns.md', 'utf-8');
    const patterns = [];
    const lines = patternContent.split('\n');
    for (const line of lines) {
        if (line.startsWith('## Pattern: ')) {
            patterns.push(line.replace('## Pattern: ', ''));
        }
    }
    res.render('index', { patterns, output: '' });
});

app.post('/run', (req, res) => {
    const { claudeResponse } = req.body;
    const command = `echo "${claudeResponse.replace(/"/g, '\\"')}" | ../bin/slop-gate-hook`;
    exec(command, (error, stdout, stderr) => {
        if (error) {
            return res.status(500).send(stderr);
        }
        res.send(stdout);
    });
});

app.get('/rules', (req, res) => {
    const patternContent = fs.readFileSync('../patterns/drift-patterns.md', 'utf-8');
    res.render('rules', { patternContent });
});

app.post('/rules', (req, res) => {
    const { patternContent } = req.body;
    fs.writeFileSync('../patterns/drift-patterns.md', patternContent);
    res.redirect('/rules');
});

app.get('/metrics', (req, res) => {
    const content = fs.readFileSync('../docs/drift-abstracts.md', 'utf-8');
    res.render('metrics', { content });
});

app.listen(PORT, () => {
    console.log(`Dashboard running at http://localhost:${PORT}`);
});
