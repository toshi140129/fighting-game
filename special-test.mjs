// 必殺技・賭け技を早期に発動して動作確認
import puppeteer from "puppeteer-core";
import fs from "fs";

const URL = "http://localhost:5174/";
const SHOTS = "./test-shots/special";
fs.mkdirSync(SHOTS, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: "new",
  args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-gl=swiftshader"],
  defaultViewport: { width: 900, height: 700 },
  protocolTimeout: 60000,
});
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (err) => {
  errors.push(`PAGEERROR: ${err.message}`);
  console.log("!!", err.message);
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const click = async (text) =>
  page.evaluate((needle) => {
    const btn = [...document.querySelectorAll("button")].find((b) =>
      b.textContent?.includes(needle)
    );
    if (btn) btn.click();
  }, text);
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
  if (!picked) return;
  await picked.click({ clickCount: 3 });
  await picked.type(value);
};

try {
  await page.goto(URL, { waitUntil: "networkidle2" });
  await click("START");
  await sleep(500);

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
    return c.toDataURL("image/jpeg", 0.85);
  });
  fs.writeFileSync(`${SHOTS}/test.jpg`, dataUrl.split(",")[1], "base64");
  const fileInput = await page.$("input[type=file]");
  await fileInput.uploadFile(`${SHOTS}/test.jpg`);
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll("img")].some(
        (i) => i.alt === "切り抜き済み" && i.naturalWidth > 0
      ),
    { timeout: 30000 }
  );
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

  // EASY を選んでCPUを弱くする
  await click("CPUと対戦");
  await sleep(400);
  await click("EASY");
  await sleep(200);
  await click("戦闘開始");
  await sleep(500);
  await click("STREET");
  await sleep(3500);

  log("Battle started, immediately testing special moves");
  await page.screenshot({ path: `${SHOTS}/00-start.png` });

  // 必殺技1
  await page.keyboard.press("KeyU");
  await sleep(400);
  await page.screenshot({ path: `${SHOTS}/01-special1.png` });

  await sleep(1500); // CD回避

  // 必殺技2
  await page.keyboard.press("KeyI");
  await sleep(400);
  await page.screenshot({ path: `${SHOTS}/02-special2.png` });

  await sleep(1500);

  // 必殺技3
  await page.keyboard.press("KeyO");
  await sleep(400);
  await page.screenshot({ path: `${SHOTS}/03-special3.png` });

  await sleep(1500);

  // 賭け技
  await page.keyboard.press("KeyH");
  await sleep(800);
  await page.screenshot({ path: `${SHOTS}/04-gamble.png` });

  await sleep(1500);

  // 移動して敵に近づきパンチ
  await page.keyboard.down("KeyD");
  await sleep(2000);
  await page.keyboard.up("KeyD");
  await sleep(200);
  await page.keyboard.press("KeyJ");
  await sleep(400);
  await page.screenshot({ path: `${SHOTS}/05-punch.png` });

  // ガード
  await page.keyboard.down("KeyL");
  await sleep(500);
  await page.screenshot({ path: `${SHOTS}/06-guard.png` });
  await page.keyboard.up("KeyL");

  log("All key tests done. Errors:", errors.length);
  errors.forEach((e) => console.log(e));
} catch (e) {
  log("FAILED:", e.message);
} finally {
  await browser.close();
}
