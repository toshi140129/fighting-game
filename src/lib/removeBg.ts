const REMOVE_BG_ENDPOINT = "https://api.remove.bg/v1.0/removebg";

const getApiKey = (): string => {
  return import.meta.env.VITE_REMOVE_BG_API_KEY ?? "";
};

export const isRemoveBgConfigured = (): boolean => !!getApiKey();

/** Base64データURLから背景を除去してBase64 PNG (透過) を返す */
export const removeBackground = async (
  imageDataUrl: string
): Promise<string> => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("Remove.bg APIキーが設定されていません");
  }

  // データURLをBlobに変換
  const blob = await dataUrlToBlob(imageDataUrl);

  const formData = new FormData();
  formData.append("image_file", blob, "input.jpg");
  formData.append("size", "preview"); // preview = 最大0.25MP・無料枠で使える
  formData.append("format", "png");

  const response = await fetch(REMOVE_BG_ENDPOINT, {
    method: "POST",
    headers: {
      "X-Api-Key": apiKey,
    },
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Remove.bg API失敗 (${response.status}): ${text.slice(0, 200)}`);
  }

  const resultBlob = await response.blob();
  return await blobToDataUrl(resultBlob);
};

const dataUrlToBlob = async (dataUrl: string): Promise<Blob> => {
  const r = await fetch(dataUrl);
  return await r.blob();
};

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("読み込み失敗"));
    reader.readAsDataURL(blob);
  });

/** ファイルが大きすぎないか、輪郭が取れそうなアスペクトかをざっくり検証 */
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
