const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

(async () => {
    const dir = path.join(__dirname, 'screenshots_for_store');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);

    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    
    // 设置 viewport 为 1200x1200
    await page.setViewport({ width: 1200, height: 1200 });
    
    // 打开主页
    try {
        await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
    } catch (e) {
        console.error("Make sure your Vite server is running");
        process.exit(1);
    }
    
    await new Promise(r => setTimeout(r, 2000));
    const targetPath = path.join(dir, 'editors_choice_graphic.png');
    await page.screenshot({ path: targetPath });
    
    await browser.close();
    console.log('1200x1200 graphic saved to', targetPath);
})();
