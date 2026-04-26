import type { VercelRequest, VercelResponse } from "@vercel/node";

const REMOVE_BG_ENDPOINT = "https://api.remove.bg/v1.0/removebg";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "8mb",
    },
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(200).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // VITE_*とは別に、サーバー専用の名前で読む（クライアントに露出しないように）
  const apiKey =
    process.env.REMOVE_BG_API_KEY ?? process.env.VITE_REMOVE_BG_API_KEY ?? "";
  if (!apiKey) {
    return res
      .status(500)
      .json({ error: "サーバーにRemove.bg APIキーが設定されていません" });
  }

  try {
    const body = req.body;
    const dataUrl: string | undefined =
      typeof body === "object" && body !== null
        ? (body.imageDataUrl as string)
        : typeof body === "string"
        ? JSON.parse(body).imageDataUrl
        : undefined;

    if (!dataUrl || !dataUrl.startsWith("data:image/")) {
      return res
        .status(400)
        .json({ error: "imageDataUrl (data URL形式) が必要です" });
    }

    // dataURL → Buffer
    const commaIdx = dataUrl.indexOf(",");
    const base64 = dataUrl.slice(commaIdx + 1);
    const buffer = Buffer.from(base64, "base64");

    // multipart/form-data を組み立て
    const boundary =
      "----RemoveBgBoundary" + Math.random().toString(36).slice(2);
    const parts: (string | Buffer)[] = [];
    const push = (s: string) => parts.push(s);

    push(`--${boundary}\r\n`);
    push(`Content-Disposition: form-data; name="size"\r\n\r\npreview\r\n`);

    push(`--${boundary}\r\n`);
    push(`Content-Disposition: form-data; name="format"\r\n\r\npng\r\n`);

    push(`--${boundary}\r\n`);
    push(
      `Content-Disposition: form-data; name="image_file"; filename="input.jpg"\r\n`
    );
    push(`Content-Type: image/jpeg\r\n\r\n`);
    parts.push(buffer);
    push(`\r\n--${boundary}--\r\n`);

    const bodyBuffer = Buffer.concat(
      parts.map((p) => (typeof p === "string" ? Buffer.from(p) : p))
    );

    const response = await fetch(REMOVE_BG_ENDPOINT, {
      method: "POST",
      headers: {
        "X-Api-Key": apiKey,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Content-Length": String(bodyBuffer.length),
      },
      body: bodyBuffer,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return res.status(response.status).json({
        error: `Remove.bg API失敗 (${response.status})`,
        detail: text.slice(0, 500),
      });
    }

    const arrayBuffer = await response.arrayBuffer();
    const resultBase64 = Buffer.from(arrayBuffer).toString("base64");

    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(200).json({
      imageDataUrl: `data:image/png;base64,${resultBase64}`,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return res.status(500).json({ error: "サーバー側エラー", detail: msg });
  }
}
