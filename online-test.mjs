import puppeteer from "puppeteer-core";
import fs from "fs";

const URL = "http://localhost:5174/";
const SHOTS = "./test-shots/online";
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

const setupPage = async (label) => {
  const page = await browser.newPage();
  page.on("pageerror", (e) => log(`[${label}] PAGEERROR:`, e.message));
  page.on("console", (m) => {
    if (m.type() === "error") log(`[${label}] CONSOLE ERROR:`, m.text());
  });
  return page;
};

const clickButton = async (page, text) => {
  await page.evaluate((needle) => {
    const btn = [...document.querySelectorAll("button")].find((b) =>
      b.textContent?.includes(needle)
    );
    if (btn) btn.click();
  }, text);
};

const typeIntoIndexedInput = async (page, idx, value) => {
  // 全input要素のうちtype=textのもののみ
  const list = await page.evaluate(() =>
    [...document.querySelectorAll("input")].map((i) => i.type)
  );
  const inputs = await page.$$("input");
  let textIdx = -1;
  let pickedHandle = null;
  for (let i = 0; i < list.length; i++) {
    if (list[i] === "text") {
      textIdx++;
      if (textIdx === idx) {
        pickedHandle = inputs[i];
        break;
      }
    }
  }
  if (!pickedHandle) {
    console.log("Available inputs:", list);
    throw new Error(`No input at text index ${idx}`);
  }
  await pickedHandle.click({ clickCount: 3 });
  await pickedHandle.type(value);
};

const buildCharacter = async (page, name, traits) => {
  await page.goto(URL, { waitUntil: "networkidle2", timeout: 30000 });
  await clickButton(page, "START");
  await sleep(500);

  fs.writeFileSync(
    "./test-shots/online/test-img.png",
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAEklEQVR42mP8/5+hngEKGAEAQAUEAfEqs0wAAAAASUVORK5CYII=",
      "base64"
    )
  );
  const fileInput = await page.$("input[type=file]");
  await fileInput.uploadFile("./test-shots/online/test-img.png");
  await sleep(800);
  await typeIntoIndexedInput(page, 0, name);
  await sleep(200);
  await clickButton(page, "次へ");
  await sleep(1000);

  await typeIntoIndexedInput(page, 0, traits[0]);
  await typeIntoIndexedInput(page, 1, traits[1]);
  await typeIntoIndexedInput(page, 2, traits[2]);
  await sleep(200);
  await clickButton(page, "必殺技を生成");
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll("*")].some((el) =>
        el.textContent?.includes("ポイント配分")
      ),
    { timeout: 30000 }
  );
  await sleep(300);
  await clickButton(page, "プレビュー");
  await sleep(400);
  await clickButton(page, "このキャラで確定");
  await sleep(500);
};

try {
  log("=== Setting up Player 1 (host) ===");
  const p1 = await setupPage("P1");
  await buildCharacter(p1, "ホスト太郎", ["背高", "ピアノ", "プログラマー"]);

  await clickButton(p1, "ルームを作る");
  await p1.waitForFunction(
    () =>
      [...document.querySelectorAll("*")].some(
        (el) => el.textContent?.match(/^\d{4}$/)
      ),
    { timeout: 10000 }
  );

  const roomCode = await p1.evaluate(() => {
    const el = [...document.querySelectorAll("*")].find((e) =>
      e.textContent?.match(/^\d{4}$/)
    );
    return el?.textContent?.match(/\d{4}/)?.[0];
  });
  log("Room code:", roomCode);
  await p1.screenshot({ path: `${SHOTS}/p1-host.png` });

  log("=== Setting up Player 2 (joiner) ===");
  const p2 = await setupPage("P2");
  await buildCharacter(p2, "ゲスト花子", ["眼鏡", "ピアノ", "学生"]);

  await clickButton(p2, "ルームに入る");
  await sleep(500);
  await typeIntoIndexedInput(p2, 0, roomCode);
  await sleep(200);
  await p2.screenshot({ path: `${SHOTS}/p2-before-join.png` });
  await clickButton(p2, "入室する");
  await sleep(2000);
  await p2.screenshot({ path: `${SHOTS}/p2-after-join.png` });

  log("=== Both should now reach stage picker ===");
  let p1ok = true;
  await p1.waitForFunction(
    () =>
      [...document.querySelectorAll("*")].some((el) =>
        el.textContent?.includes("ステージ選択")
      ),
    { timeout: 15000 }
  ).catch(() => {
    p1ok = false;
  });
  const p1Text = await p1.evaluate(() => document.body.innerText.slice(0, 200));
  log("P1 reached:", p1ok, "text:", p1Text.replace(/\n/g, " | "));

  let p2ok = true;
  await p2.waitForFunction(
    () =>
      [...document.querySelectorAll("*")].some((el) =>
        el.textContent?.includes("ステージ選択")
      ),
    { timeout: 5000 }
  ).catch(() => {
    p2ok = false;
  });
  const p2Text = await p2.evaluate(() => document.body.innerText.slice(0, 200));
  log("P2 reached:", p2ok, "text:", p2Text.replace(/\n/g, " | "));

  if (!p1ok || !p2ok) {
    log("ABORTING: stage picker not reached on both sides");
    process.exit(1);
  }

  await clickButton(p1, "STREET");
  await clickButton(p2, "STREET");
  await sleep(3500);
  await p1.screenshot({ path: `${SHOTS}/p1-battle.png` });
  await p2.screenshot({ path: `${SHOTS}/p2-battle.png` });
  log("Both battle scenes loaded");

  // P1がパンチ→P2画面で再生されることを期待
  log("=== P1 punches ===");
  await p1.bringToFront();
  await p1.keyboard.press("KeyJ");
  await sleep(500);
  await p1.keyboard.press("KeyJ");
  await sleep(500);
  await p1.screenshot({ path: `${SHOTS}/p1-after-punch.png` });
  await p2.screenshot({ path: `${SHOTS}/p2-after-p1-punch.png` });

  // P2が必殺技
  log("=== P2 special ===");
  await p2.bringToFront();
  await p2.keyboard.press("KeyU");
  await sleep(800);
  await p1.screenshot({ path: `${SHOTS}/p1-after-p2-special.png` });
  await p2.screenshot({ path: `${SHOTS}/p2-after-special.png` });

  // P1が移動
  log("=== P1 walks forward ===");
  await p1.bringToFront();
  await p1.keyboard.down("KeyD");
  await sleep(800);
  await p1.keyboard.up("KeyD");
  await sleep(300);
  await p1.screenshot({ path: `${SHOTS}/p1-walked.png` });
  await p2.screenshot({ path: `${SHOTS}/p2-saw-p1-walk.png` });

  log("ALL DONE");
} catch (e) {
  log("FAILED:", e.message);
  log(e.stack);
} finally {
  await browser.close();
}
