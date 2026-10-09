const { chromium } = require("C:\\Users\\lzhumy\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\node_modules\\playwright");
(async () => {
  try {
    console.log("Launching browser...");
    const browser = await chromium.launch({ headless: true });
    console.log("Browser launched.");
    const page = await browser.newPage();
    console.log("Navigating to https://app.liujingzhuwo.site/...");
    await page.goto("https://app.liujingzhuwo.site/", { timeout: 30000, waitUntil: "networkidle" });
    console.log("Title:", await page.title());
    await page.screenshot({ path: "D:\\cursor\\work\\super-agent\\test-screenshot.png" });
    console.log("Screenshot saved.");
    await browser.close();
  } catch (e) {
    console.error("Error occurred:", e);
  }
})();
