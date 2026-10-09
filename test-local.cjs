const { chromium } = require("C:\\Users\\lzhumy\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\node_modules\\.pnpm\\playwright-core@1.60.0\\node_modules\\playwright-core");
(async () => {
  try {
    console.log("Launching browser with channel: chrome...");
    const browser = await chromium.launch({ headless: true, channel: "chrome" });
    const context = await browser.newContext();
    const page = await context.newPage();
    console.log("Navigating to http://127.0.0.1:3000/...");
    await page.goto("http://127.0.0.1:3000/", { timeout: 10000, waitUntil: "domcontentloaded" });
    
    console.log("Disabling global interceptor...");
    await page.evaluate(() => {
      localStorage.setItem('super_agent_global_interceptor', 'false');
    });
    
    console.log("Reloading page...");
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    
    console.log("Page loaded. Title:", await page.title());
    await page.screenshot({ path: "D:\\cursor\\work\\super-agent\\dist\\test-local-screenshot.png" });
    console.log("Screenshot saved.");
    await browser.close();
  } catch (e) {
    console.error("Error:", e);
  }
})();
