import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/**
 * 開発時に /api/remove-bg をVercelと同じインターフェースで提供する。
 * 本番はVercel Serverless Function (api/remove-bg.ts) が処理する。
 */
const devApiPlugin = (env: Record<string, string>): Plugin => ({
  name: "dev-api-remove-bg",
  configureServer(server) {
    server.middlewares.use("/api/remove-bg", async (req, res) => {
      if (req.method !== "POST") {
        res.statusCode = 405;
        res.end(JSON.stringify({ error: "Method not allowed" }));
        return;
      }
      try {
        // body読み取り
        const chunks: Buffer[] = [];
        for await (const c of req) chunks.push(Buffer.from(c));
        const raw = Buffer.concat(chunks).toString("utf8");
        const body = JSON.parse(raw);
        const dataUrl = body.imageDataUrl as string | undefined;
        if (!dataUrl) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "imageDataUrl が必要です" }));
          return;
        }

        const apiKey =
          env.REMOVE_BG_API_KEY ||
          env.VITE_REMOVE_BG_API_KEY ||
          process.env.REMOVE_BG_API_KEY ||
          process.env.VITE_REMOVE_BG_API_KEY ||
          "";
        if (!apiKey) {
          res.statusCode = 500;
          res.end(
            JSON.stringify({
              error:
                "Remove.bg APIキーが.env.localに設定されていません (VITE_REMOVE_BG_API_KEY)",
            })
          );
          return;
        }

        const commaIdx = dataUrl.indexOf(",");
        const base64 = dataUrl.slice(commaIdx + 1);
        const buffer = Buffer.from(base64, "base64");

        const boundary =
          "----RemoveBgBoundary" + Math.random().toString(36).slice(2);
        const parts: (string | Buffer)[] = [];
        parts.push(`--${boundary}\r\n`);
        parts.push(`Content-Disposition: form-data; name="size"\r\n\r\npreview\r\n`);
        parts.push(`--${boundary}\r\n`);
        parts.push(`Content-Disposition: form-data; name="format"\r\n\r\npng\r\n`);
        parts.push(`--${boundary}\r\n`);
        parts.push(
          `Content-Disposition: form-data; name="image_file"; filename="input.jpg"\r\n`
        );
        parts.push(`Content-Type: image/jpeg\r\n\r\n`);
        parts.push(buffer);
        parts.push(`\r\n--${boundary}--\r\n`);

        const bodyBuffer = Buffer.concat(
          parts.map((p) => (typeof p === "string" ? Buffer.from(p) : p))
        );

        const response = await fetch("https://api.remove.bg/v1.0/removebg", {
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
          res.statusCode = response.status;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              error: `Remove.bg API失敗 (${response.status})`,
              detail: text.slice(0, 500),
            })
          );
          return;
        }

        const arrayBuffer = await response.arrayBuffer();
        const resultBase64 = Buffer.from(arrayBuffer).toString("base64");
        res.setHeader("Content-Type", "application/json");
        res.statusCode = 200;
        res.end(
          JSON.stringify({
            imageDataUrl: `data:image/png;base64,${resultBase64}`,
          })
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        res.statusCode = 500;
        res.end(JSON.stringify({ error: "サーバー側エラー", detail: msg }));
      }
    });
  },
});

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), devApiPlugin(env)],
  };
});
