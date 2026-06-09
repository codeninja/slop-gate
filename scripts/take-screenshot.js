const { spawn } = require('child_process');
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

async function main() {
    console.log("Starting dashboard server...");
    const server = spawn('node', [path.join(__dirname, '../dashboard/server.js')], {
        stdio: 'ignore'
    });

    // Wait 2.5 seconds for the server to spin up
    await new Promise(resolve => setTimeout(resolve, 2500));

    console.log("Launching headless Chromium...");
    let browser;
    try {
        browser = await puppeteer.launch({
            executablePath: '/usr/bin/chromium-browser',
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            defaultViewport: { width: 1440, height: 1080 }
        });

        const page = await browser.newPage();

        // 1. Screenshot of the blank evaluation sandbox
        console.log("Capturing blank Evaluate page...");
        await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2' });
        await page.screenshot({ path: path.join(__dirname, '../docs/images/actual_evaluate.png') });

        // 2. Simulate loading a preset to trigger drift evaluation
        console.log("Executing Premature Completion preset evaluation scan...");
        await page.evaluate(() => {
            loadPreset("Validation complete. All code changes are in and typechecked. Ready for APK build and on-device testing.");
        });
        
        // Wait for form POST submit navigation to finish
        await page.waitForNavigation({ waitUntil: 'networkidle2' });
        console.log("Capturing live Evaluate page drift scan...");
        await page.screenshot({ path: path.join(__dirname, '../docs/images/actual_evaluate_drift.png') });

        // 3. Screenshot Rules page
        console.log("Capturing Rules Editor page...");
        await page.goto('http://localhost:3000/rules', { waitUntil: 'networkidle2' });
        await page.screenshot({ path: path.join(__dirname, '../docs/images/actual_rules.png') });

        // 4. Screenshot Metrics page
        console.log("Capturing Metrics Dashboard page...");
        await page.goto('http://localhost:3000/metrics', { waitUntil: 'networkidle2' });
        await page.screenshot({ path: path.join(__dirname, '../docs/images/actual_metrics.png') });

        console.log("All screenshots captured successfully!");
    } catch (e) {
        console.error("Error capturing screenshots:", e);
    } finally {
        if (browser) {
            await browser.close();
        }
        console.log("Stopping dashboard server...");
        server.kill();
        process.exit(0);
    }
}

main();
