import puppeteer from "puppeteer-core";
import fs from "fs";

const URL = "http://localhost:5174/";
const SCREENSHOT_DIR = "./test-shots";
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: "new",
  args: [
    "--no-sandbox",
    "--enable-unsafe-swiftshader",
    "--use-gl=swiftshader",
    "--enable-webgl",
    "--ignore-gpu-blocklist",
  ],
  defaultViewport: { width: 900, height: 700 },
});

const page = await browser.newPage();

const errors = [];
const consoleMessages = [];

page.on("console", (msg) => {
  const text = `[${msg.type()}] ${msg.text()}`;
  consoleMessages.push(text);
  if (text.includes("BattleScene") || text.includes("battleInput")) console.log("BROWSER:", text);
});
page.on("pageerror", (err) => {
  errors.push(`PAGE ERROR: ${err.message}\n${err.stack || ""}`);
});

const log = (...args) => console.log(new Date().toISOString().slice(11, 19), ...args);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const clickButtonWithText = async (text) => {
  await page.evaluate((needle) => {
    const btn = [...document.querySelectorAll("button")].find((b) =>
      b.textContent?.includes(needle)
    );
    if (btn) btn.click();
  }, text);
};

const typeIntoInputByPlaceholder = async (placeholderSubstr, value) => {
  // Build CSS selector by getting an index match
  const idx = await page.evaluate((sub) => {
    const inputs = [...document.querySelectorAll("input")];
    return inputs.findIndex((i) => i.placeholder && i.placeholder.includes(sub));
  }, placeholderSubstr);
  if (idx < 0) {
    log(`Input not found for placeholder: ${placeholderSubstr}`);
    return;
  }
  const elements = await page.$$("input");
  const el = elements[idx];
  await el.click({ clickCount: 3 });
  await el.type(value);
};

try {
  log("Navigating...");
  await page.goto(URL, { waitUntil: "networkidle2", timeout: 30000 });
  await page.screenshot({ path: `${SCREENSHOT_DIR}/01-title.png` });
  log("Title screen OK");

  await clickButtonWithText("START");
  await sleep(500);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/02-upload.png` });

  // ダミー画像を作成（小さいJPEG）
  fs.writeFileSync(
    "./test-shots/test-img.png",
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAEklEQVR42mP8/5+hngEKGAEAQAUEAfEqs0wAAAAASUVORK5CYII=",
      "base64"
    )
  );
  const fileInput = await page.$("input[type=file]");
  await fileInput.uploadFile("./test-shots/test-img.png");
  await sleep(800);

  await typeIntoInputByPlaceholder("闇の戦士", "テスター");
  await sleep(200);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/03-uploaded.png` });

  await clickButtonWithText("次へ");
  await sleep(1500);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/04-personality.png` });
  log("Personality screen OK");

  // デバッグ：全input placeholderを表示
  const placeholders = await page.evaluate(() =>
    [...document.querySelectorAll("input")].map((i) => `${i.type}:${i.placeholder}`)
  );
  log("Inputs:", placeholders);

  await typeIntoInputByPlaceholder("出っ歯", "天然パーマ");
  await typeIntoInputByPlaceholder("サッカー", "プログラミング");
  await typeIntoInputByPlaceholder("エンジニア", "エンジニア");
  await sleep(200);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/04b-personality-filled.png` });

  await clickButtonWithText("必殺技を生成");
  // Claude APIレスポンス待ち
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll("*")].some((el) =>
        el.textContent?.includes("ポイント配分")
      ),
    { timeout: 30000 }
  );
  await sleep(500);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/05-allocate.png` });
  log("Allocation screen OK");

  await clickButtonWithText("プレビュー");
  await sleep(500);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/06-preview.png` });

  await clickButtonWithText("このキャラで確定");
  await sleep(500);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/07-matchmaking.png` });
  log("Matchmaking screen OK");

  await clickButtonWithText("CPUと対戦");
  await sleep(500);
  await clickButtonWithText("戦闘開始");
  await sleep(700);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/08-stage-pick.png` });
  log("Stage picker OK");

  await clickButtonWithText("STREET");
  await sleep(2500);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/09-battle.png` });
  log("Battle screen reached");

  await sleep(3000);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/10-battle-mid.png` });

  // キーボード操作テスト
  log("Testing keyboard inputs...");
  await page.keyboard.press("KeyJ"); // パンチ
  await sleep(300);
  await page.keyboard.press("KeyK"); // キック
  await sleep(300);
  await page.keyboard.press("KeyU"); // 必殺技1
  await sleep(500);
  await page.keyboard.press("KeyH"); // 賭け技
  await sleep(1500);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/11-after-attacks.png` });

  log("\n=== ERRORS ===");
  errors.forEach((e) => log(e));
  log("\n=== CONSOLE WARN/ERROR ===");
  consoleMessages.filter((m) => /\[error\]|\[warn/i.test(m)).forEach((m) => log(m));
  log(`\nTotal pageerrors: ${errors.length}`);
  log(`Total console msgs: ${consoleMessages.length}`);
} catch (e) {
  log("TEST FAILED:", e.message);
  log(e.stack);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/FAIL.png` }).catch(() => {});
} finally {
  await browser.close();
}
