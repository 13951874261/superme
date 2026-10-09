const express = require('express');
const http = require('http');
const path = require('path');
const { chromium } = require("@playwright/test");

const app = express();
app.use(express.static(path.join(__dirname, 'dist')));
const server = http.createServer(app);

server.listen(3000, '127.0.0.1', async () => {
  console.log('Express server started at http://127.0.0.1:3000');
  try {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    console.log("Navigating to http://127.0.0.1:3000/...");
    await page.goto("http://127.0.0.1:3000/", { timeout: 15000, waitUntil: "domcontentloaded" });
    console.log("Title:", await page.title());
    
    await page.screenshot({ path: path.join(__dirname, "dist", "test-local-screenshot.png") });
    console.log("Screenshot saved.");
    await browser.close();
  } catch (e) {
    console.error("Test error:", e);
  } finally {
    server.close();
    console.log("Express server closed.");
    process.exit(0);
  }
});