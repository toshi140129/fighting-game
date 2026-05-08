// 実画像でRemove.bg API Route をテスト（puppeteerでブラウザcanvasから画像生成）
import puppeteer from "puppeteer-core";
import fs from "fs";

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: "new",
  args: ["--no-sandbox"],
});
const page = await browser.newPage();

// canvasで簡易シルエット画像を作成し、データURLとして取得
await page.goto("about:blank");
const dataUrl = await page.evaluate(() => {
  const c = document.createElement("canvas");
  c.width = 200;
  c.height = 300;
  const ctx = c.getContext("2d");
  // 背景：薄い肌色
  ctx.fillStyle = "#f4dcb6";
  ctx.fillRect(0, 0, 200, 300);
  // 人型シルエット
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
fs.mkdirSync("./test-shots", { recursive: true });
fs.writeFileSync("./test-shots/silhouette.jpg", dataUrl.split(",")[1], "base64");
console.log("Generated test image:", dataUrl.length, "chars");

// /api/remove-bg を叩く
const r = await fetch("http://localhost:5174/api/remove-bg", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ imageDataUrl: dataUrl }),
});
console.log("status:", r.status);
const text = await r.text();
if (r.status === 200) {
  const j = JSON.parse(text);
  console.log("success: cutout length", j.imageDataUrl?.length);
  fs.writeFileSync(
    "./test-shots/cutout.png",
    j.imageDataUrl.split(",")[1],
    "base64"
  );
  console.log("Cutout saved to ./test-shots/cutout.png");
} else {
  console.log("error:", text.slice(0, 300));
}

await browser.close();
