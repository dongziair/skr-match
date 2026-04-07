const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

(async () => {
    const dir = path.join(__dirname, 'screenshots_for_store');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);

    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    
    // 允许执行本地 storage 修改，如果有必要
    const url = 'http://localhost:5173/';
    
    try {
        await page.goto(url, { waitUntil: 'networkidle0' });
    } catch (e) {
        console.error("Make sure your Vite server is running at", url);
        process.exit(1);
    }
    
    console.log('Capturing Banner...');
    await page.setViewport({ width: 1200, height: 600 });
    await new Promise(r => setTimeout(r, 3000));
    await page.screenshot({ path: path.join(dir, 'banner.png') });

    console.log('Capturing Preview 1 (Home)...');
    await page.setViewport({ width: 1080, height: 1920, isMobile: true, hasTouch: true });
    await page.reload({ waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: path.join(dir, 'preview1.png') });

    console.log('Capturing Preview 2...');
    let buttons = await page.$$('button');
    for (const btn of buttons) {
        const text = await page.evaluate(el => el.textContent, btn);
        if (text && text.toLowerCase().includes('spin')) {
            await btn.click();
            await new Promise(r => setTimeout(r, 1500));
            break;
        }
    }
    await page.screenshot({ path: path.join(dir, 'preview2.png') });
    await page.reload({ waitUntil: 'networkidle0' });

    console.log('Capturing Preview 3...');
    buttons = await page.$$('button');
    for (const btn of buttons) {
        const text = await page.evaluate(el => el.textContent, btn);
        if (text && text.toLowerCase().includes('leaderboard')) {
            await btn.click();
            await new Promise(r => setTimeout(r, 1500));
            break;
        }
    }
    await page.screenshot({ path: path.join(dir, 'preview3.png') });
    await page.reload({ waitUntil: 'networkidle0' });

    console.log('Capturing Preview 4...');
    // 强制触发一个可能的游戏状态或改变背景特效颜色，如果没有的话
    await page.evaluate(() => {
        // 尝试去掉蒙层或者给出一个花哨的游戏状态
        document.body.style.filter = "hue-rotate(90deg)"; 
    });
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: path.join(dir, 'preview4.png') });

    await browser.close();
    console.log('All screenshots captured successfully.');
})();
