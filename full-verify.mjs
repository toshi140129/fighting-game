// ローカル動作検証：Remove.bg / 60秒バトル / 必殺技・賭け技
import puppeteer from "puppeteer-core";
import fs from "fs";

const URL = "http://localhost:5174/";
const SHOTS = "./test-shots/full";
fs.mkdirSync(SHOTS, { recursive: true });

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
  protocolTimeout: 90000,
});

const page = await browser.newPage();
const errors = [];
const consoleMessages = [];

page.on("console", (msg) => {
  consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
});
page.on("pageerror", (err) => {
  errors.push(`PAGEERROR: ${err.message}`);
});
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const click = async (text) => {
  await page.evaluate((needle) => {
    const btn = [...document.querySelectorAll("button")].find((b) =>
      b.textContent?.includes(needle)
    );
    if (btn) btn.click();
  }, text);
};
const typeIn = async (idx, value) => {
  const list = await page.evaluate(() =>
    [...document.querySelectorAll("input")].map((i) => i.type)
  );
  const inputs = await page.$$("input");
  let textIdx = -1;
  let picked = null;
  for (let i = 0; i < list.length; i++) {
    if (list[i] === "text") {
      textIdx++;
      if (textIdx === idx) {
        picked = inputs[i];
        break;
      }
    }
  }
  if (!picked) throw new Error(`No input at idx ${idx}`);
  await picked.click({ clickCount: 3 });
  await picked.type(value);
};

try {
  log("Navigating...");
  await page.goto(URL, { waitUntil: "networkidle2", timeout: 30000 });
  await click("START");
  await sleep(500);

  // === 1) Remove.bg統合確認用：シルエット画像をアップロード ===
  log("=== Test 1: 写真アップロード+背景除去 ===");

  // canvasで実画像生成
  const dataUrl = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 200;
    c.height = 300;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#f4dcb6";
    ctx.fillRect(0, 0, 200, 300);
    ctx.fillStyle = "#222";
    ctx.beginPath();
    ctx.arc(100, 70, 36, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(72, 110, 56, 110);
    ctx.fillRect(54, 120, 22, 80);
    ctx.fillRect(124, 120, 22, 80);
    ctx.fillRect(80, 220, 16, 70);
    ctx.fillRect(104, 220, 16, 70);
    return c.toDataURL("image/jpeg", 0.85);
  });
  fs.writeFileSync(
    `${SHOTS}/silhouette.jpg`,
    dataUrl.split(",")[1],
    "base64"
  );

  const fileInput = await page.$("input[type=file]");
  await fileInput.uploadFile(`${SHOTS}/silhouette.jpg`);

  // 処理中スピナー → 切り抜き完了を待つ
  log("待機: 背景除去処理中...");
  await page.waitForFunction(
    () => {
      const imgs = [...document.querySelectorAll("img")];
      return imgs.some(
        (i) => i.alt === "切り抜き済み" && i.naturalWidth > 0
      );
    },
    { timeout: 30000 }
  );
  log("✅ 背景除去成功・プレビュー表示確認");
  await page.screenshot({
    path: `${SHOTS}/01-cutout-preview.png`,
    captureBeyondViewport: false,
  });

  await typeIn(0, "テスター");
  await click("次へ");
  await sleep(1500);
  await typeIn(0, "メガネ");
  await typeIn(1, "ピアノ");
  await typeIn(2, "学生");
  await click("必殺技を生成");
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll("*")].some((el) =>
        el.textContent?.includes("ポイント配分")
      ),
    { timeout: 30000 }
  );
  await sleep(300);
  await click("プレビュー");
  await sleep(400);
  await click("このキャラで確定");
  await sleep(400);
  await click("CPUと対戦");
  await sleep(400);
  await click("戦闘開始");
  await sleep(500);
  await click("STREET");
  await sleep(3500);
  log("Battle screen reached");
  await page.screenshot({
    path: `${SHOTS}/02-battle-start.png`,
    captureBeyondViewport: false,
  });

  // === 2) 60秒バトル進行確認 ===
  log("=== Test 2: 60秒バトル進行確認 ===");

  const startedAt = Date.now();
  // 5秒・15秒・30秒・55秒地点でスクショとログ
  const checkpoints = [5, 15, 30, 45, 55];
  for (const sec of checkpoints) {
    while (Date.now() - startedAt < sec * 1000) await sleep(500);
    const ended = await page.evaluate(() => {
      const t = document.body.innerText;
      return /DRAW|WIN|LOSE|K\.O\.|もう一戦|実況/.test(t);
    });
    log(`[t=${sec}s] ended=${ended}`);
    if (ended) {
      log(`⚠ ${sec}秒で終了（早すぎる！）`);
      await page.screenshot({
        path: `${SHOTS}/early-end-${sec}s.png`,
      });
      break;
    }
    await page.screenshot({
      path: `${SHOTS}/03-battle-${sec}s.png`,
      captureBeyondViewport: false,
    });
  }

  // === 3) 必殺技・賭け技テスト ===
  log("=== Test 3: 必殺技・賭け技 ===");
  // バトル中にキー入力
  log("U キー（必殺技1）");
  await page.keyboard.press("KeyU");
  await sleep(700);
  await page.screenshot({
    path: `${SHOTS}/04-special-1.png`,
    captureBeyondViewport: false,
  });

  log("I キー（必殺技2）");
  await page.keyboard.press("KeyI");
  await sleep(700);
  await page.screenshot({
    path: `${SHOTS}/05-special-2.png`,
    captureBeyondViewport: false,
  });

  log("O キー（必殺技3）");
  await page.keyboard.press("KeyO");
  await sleep(700);
  await page.screenshot({
    path: `${SHOTS}/06-special-3.png`,
    captureBeyondViewport: false,
  });

  log("H キー（賭け技）");
  await page.keyboard.press("KeyH");
  await sleep(1500);
  await page.screenshot({
    path: `${SHOTS}/07-gamble.png`,
    captureBeyondViewport: false,
  });

  // 60秒経過まで待ち、終了画面確認
  while (Date.now() - startedAt < 65 * 1000) await sleep(1000);
  await sleep(2000);
  await page.screenshot({
    path: `${SHOTS}/08-after-60s.png`,
    captureBeyondViewport: false,
  });
  const finalText = await page.evaluate(() =>
    document.body.innerText.slice(0, 500).replace(/\n/g, " | ")
  );
  log("Final state:", finalText.slice(0, 200));

  log("\n=== ERRORS ===");
  errors.forEach((e) => console.log(e));
  log("\n=== Console errors only ===");
  consoleMessages
    .filter((m) => m.startsWith("[error]"))
    .forEach((m) => console.log(m));
  log("\n=== Console logs (BattleScene) ===");
  consoleMessages
    .filter((m) => m.includes("BattleScene"))
    .forEach((m) => console.log(m));
} catch (e) {
  log("FAILED:", e.message);
  log(e.stack);
} finally {
  await browser.close();
}
