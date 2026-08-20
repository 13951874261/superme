const { chromium } = require("C:\\Users\\lzhumy\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\node_modules\\playwright");

(async () => {
  let browser;
  try {
    console.log("Launching browser...");
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    console.log("Navigating to http://localhost:3000/...");
    await page.goto("http://localhost:3000/", { timeout: 15000, waitUntil: "networkidle" });
    
    console.log("Page title:", await page.title());
    
    // 截图未点击前的页面
    await page.screenshot({ path: "D:\\cursor\\work\\super-agent\\scratch\\before-click.png" });
    console.log("Saved scratch/before-click.png");

    // 寻找“自定义”按钮
    // 按钮文本通常包含 "自定义"
    const btn = page.locator('button:has-text("自定义")');
    if (await btn.count() > 0) {
      console.log("Found '自定义' button! Clicking it...");
      await btn.first().click();
      
      // 等待 modal 动画
      await page.waitForTimeout(1000);
      
      // 截图点击后的页面
      await page.screenshot({ path: "D:\\cursor\\work\\super-agent\\scratch\\after-click.png" });
      console.log("Saved scratch/after-click.png");
      
      // 检查页面中是否出现了 Modal 中的文本，比如 "创建自定义练习场景"
      const modalText = page.locator(':has-text("创建自定义练习场景")');
      if (await modalText.count() > 0) {
        console.log("SUCCESS: Modal is visible on screen!");
      } else {
        console.log("FAIL: Clicked but '创建自定义练习场景' modal text not found.");
      }
    } else {
      console.log("FAIL: '自定义' button not found on page. Checking if login is required or page structure is different.");
      // 打印页面中的一些文本以便调试
      const bodyText = await page.innerText('body');
      console.log("Body preview:", bodyText.substring(0, 500));
    }
  } catch (e) {
    console.error("Error occurred:", e);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
})();
