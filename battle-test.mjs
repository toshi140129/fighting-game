import puppeteer from "puppeteer-core";
import fs from "fs";

const URL = process.env.URL || "http://localhost:5174/";
const SHOTS = "./test-shots/battle";
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
  protocolTimeout: 60000,
});

const page = await browser.newPage();

// モバイルエミュレーション
if (process.env.MOBILE) {
  await page.emulate({
    name: "iPhone",
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
    viewport: { width: 390, height: 844, isMobile: true, hasTouch: true },
  });
}

const errors = [];
const consoleMessages = [];

page.on("console", (msg) => {
  const t = `[${msg.type()}] ${msg.text()}`;
  consoleMessages.push(t);
});
page.on("pageerror", (err) => {
  errors.push(`PAGEERROR: ${err.message}\n${err.stack}`);
  console.log(`!! PAGEERROR: ${err.message}`);
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

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

  fs.writeFileSync(
    `${SHOTS}/test.png`,
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAEklEQVR42mP8/5+hngEKGAEAQAUEAfEqs0wAAAAASUVORK5CYII=",
      "base64"
    )
  );
  const fileInput = await page.$("input[type=file]");
  await fileInput.uploadFile(`${SHOTS}/test.png`);
  await sleep(800);
  await typeIn(0, "テスター");
  await sleep(200);
  await click("次へ");
  await sleep(1500);
  await typeIn(0, "メガネ");
  await typeIn(1, "ピアノ");
  await typeIn(2, "学生");
  await sleep(200);
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
  await sleep(3000);

  log("Battle screen reached. Now monitoring battle progression...");
  await page.screenshot({ path: `${SHOTS}/start.png`, captureBeyondViewport: false }).catch(() => {});

  // バトル中の状態を毎秒チェック
  for (let sec = 0; sec < 15; sec++) {
    const state = await page.evaluate(() => {
      const text = document.body.innerText.slice(0, 500).replace(/\n/g, " | ");
      // canvas情報
      const canvas = document.querySelector("canvas");
      return { text, hasCanvas: !!canvas };
    });
    log(`[t=${sec}s] canvas=${state.hasCanvas} text:`, state.text.slice(0, 200));
    if (sec === 5) {
      await page.screenshot({ path: `${SHOTS}/mid.png`, captureBeyondViewport: false }).catch(() => {});
    }
    if (state.text.includes("DRAW") || state.text.includes("WIN") || state.text.includes("LOSE") || state.text.includes("K.O.") || state.text.includes("実況")) {
      log("** BATTLE ENDED **");
      await page.screenshot({ path: `${SHOTS}/end.png`, captureBeyondViewport: false }).catch(() => {});
      break;
    }
    await sleep(1000);
  }

  log("\n=== ERRORS ===");
  errors.forEach((e) => console.log(e));
  log("\n=== Console (warn/error) ===");
  consoleMessages.filter((m) => /error|warn/i.test(m)).slice(0, 20).forEach((m) => console.log(m));
} catch (e) {
  log("FAILED:", e.message);
  log(e.stack);
} finally {
  await browser.close();
}
