/**
 * Remove.bg は本番ではVercel API Route (/api/remove-bg) 経由でサーバーサイドプロキシで叩く。
 * 開発時(vite dev)はvite.config.ts の middleware が同等のproxyを提供する。
 */

const ENDPOINT = "/api/remove-bg";

const getDirectApiKey = (): string => {
  // 開発フォールバック用：CORSが許可されていれば直接呼べる場合に備えて
  return import.meta.env.VITE_REMOVE_BG_API_KEY ?? "";
};

export const isRemoveBgConfigured = (): boolean => {
  // クライアント側はAPI Routeに投げるだけなので、APIキーの有無はサーバー側次第。
  // VITE_REMOVE_BG_API_KEY があれば「設定済」と表示する（fallbackあり）
  return !!getDirectApiKey();
};

/** Base64データURLから背景を除去してBase64 PNG (透過) を返す */
export const removeBackground = async (
  imageDataUrl: string
): Promise<string> => {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageDataUrl }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    let detail = errorText;
    try {
      const j = JSON.parse(errorText);
      detail = j.detail || j.error || errorText;
    } catch {
      // not JSON
    }
    throw new Error(
      `背景除去失敗 (HTTP ${response.status}): ${String(detail).slice(0, 200)}`
    );
  }

  const json = await response.json();
  if (!json.imageDataUrl) {
    throw new Error("レスポンスに imageDataUrl がありません");
  }
  return json.imageDataUrl as string;
};

/** 画像をRemove.bg向けに縮小（API容量節約） */
export const resizeForBgRemoval = (
  imageDataUrl: string,
  maxDim = 1024
): Promise<string> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let { width, height } = img;
      const max = Math.max(width, height);
      if (max > maxDim) {
        const scale = maxDim / max;
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("canvas context取得失敗"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => reject(new Error("画像読み込み失敗"));
    img.src = imageDataUrl;
  });
