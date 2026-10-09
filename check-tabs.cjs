const { chromium } = require("C:\\Users\\lzhumy\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\node_modules\\playwright");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  console.log('Navigating to https://app.liujingzhuwo.site/');
  await page.goto('https://app.liujingzhuwo.site/', { waitUntil: 'networkidle', timeout: 60000 });
  
  console.log('Page loaded. Swapping tabs...');
  // Find button with text '´©Í¸(¶Á)'
  const tabs = await page.locator('button').all();
  let readTab = null;
  for (const tab of tabs) {
    const text = await tab.innerText();
    if (text.includes('´©Í¸(¶Á)')) {
      readTab = tab;
      break;
    }
  }
  if (readTab) {
    console.log('Found ´©Í¸(¶Á) tab. Clicking...');
    await readTab.click();
    await page.waitForTimeout(2000);
    
    const divsInfo = await page.evaluate(() => {
      const divs = Array.from(document.querySelectorAll('div'));
      return divs.filter(d => d.className && d.className.includes('bg-') && d.className.includes('rounded-')).map(d => ({
        className: d.className,
        height: d.getBoundingClientRect().height,
        opacity: window.getComputedStyle(d).opacity
      }));
    });
    console.log('Read container divs:', divsInfo);
  } else {
    console.log('Could not find ´©Í¸(¶Á) tab');
  }

  await browser.close();
})();
