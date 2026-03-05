import puppeteer from 'puppeteer';

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    page.on('console', msg => console.log('CONSOLE:', msg.text()));
    page.on('pageerror', error => console.error('PAGE ERROR:', error.message));
    page.on('requestfailed', request => console.log('REQ FAILED:', request.url(), request.failure()?.errorText));

    try {
        await page.goto('http://localhost:8080/metodo-identidade', { waitUntil: 'networkidle2' });
        console.log('Page loaded.');
    } catch (e) {
        console.error('Goto error:', e);
    }

    await browser.close();
})();
