import { useRef, useState } from "react";
import { isRemoveBgConfigured, removeBackground, resizeForBgRemoval } from "../lib/removeBg";

interface Props {
  onNext: (data: { name: string; photoUrl: string }) => void;
}

const PORTRAIT_MAX = 600;

const loadImageToCanvas = (dataUrl: string, maxDim: number): Promise<string> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let { width, height } = img;
      const maxOf = Math.max(width, height);
      if (maxOf > maxDim) {
        const s = maxDim / maxOf;
        width = Math.round(width * s);
        height = Math.round(height * s);
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("canvas context取得失敗"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("画像読み込み失敗"));
    img.src = dataUrl;
  });

export const UploadScreen = ({ onNext }: Props) => {
  const [photoUrl, setPhotoUrl] = useState<string>("");
  const [name, setName] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const removeBgReady = isRemoveBgConfigured();

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("画像ファイルを選択してください");
      return;
    }
    setError(null);
    setPhotoUrl("");
    setProcessing(true);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const result = e.target?.result;
      if (typeof result !== "string") {
        setProcessing(false);
        return;
      }
      let preview = "";
      try {
        // プレビュー用に縮小
        preview = await loadImageToCanvas(result, PORTRAIT_MAX);

        if (removeBgReady) {
          // 背景除去：完了するまでプレビュー表示しない
          const small = await resizeForBgRemoval(preview, 1024);
          const cutout = await removeBackground(small);
          setPhotoUrl(cutout);
        } else {
          // APIキー未設定時は元画像をそのまま使う
          setPhotoUrl(preview);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "画像処理失敗";
        setError(msg + "（元画像で続行します）");
        // フォールバック：元画像でも進めるように
        if (preview) setPhotoUrl(preview);
      } finally {
        setProcessing(false);
      }
    };
    reader.onerror = () => {
      setError("ファイル読み込み失敗");
      setProcessing(false);
    };
    reader.readAsDataURL(file);
  };

  const canProceed = !!photoUrl && name.trim().length > 0 && !processing;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-purple-900 text-white p-4">
      <div className="max-w-md mx-auto">
        <h1 className="text-3xl font-bold text-center mb-2 mt-8">キャラを作る</h1>
        <p className="text-center text-purple-200 mb-2">写真と名前を入力してね</p>
        <div className="text-center text-yellow-300 text-sm mb-4 px-2">
          📸 全身が写るように撮影してください
          <br />
          <span className="text-xs text-yellow-200/80">
            （背景は自動で除去されます）
          </span>
        </div>

        <div className="bg-slate-800/60 rounded-2xl p-6 border border-purple-500/30 space-y-4">
          <div>
            <label className="block text-sm text-purple-200 mb-2">全身写真</label>
            <div
              onClick={() => !processing && fileRef.current?.click()}
              className="aspect-[3/4] w-full bg-slate-900/80 border-2 border-dashed border-purple-500/40 rounded-xl flex items-center justify-center cursor-pointer overflow-hidden relative"
              style={{
                backgroundImage:
                  "linear-gradient(45deg, #1a1a2a 25%, transparent 25%), linear-gradient(-45deg, #1a1a2a 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1a1a2a 75%), linear-gradient(-45deg, transparent 75%, #1a1a2a 75%)",
                backgroundSize: "16px 16px",
                backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
              }}
            >
              {processing ? (
                <div className="flex flex-col items-center justify-center">
                  <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-400 rounded-full animate-spin"></div>
                  <p className="text-yellow-300 font-bold text-lg mt-4 animate-pulse">
                    背景除去中...
                  </p>
                  <p className="text-xs text-purple-300 mt-1">数秒かかります</p>
                </div>
              ) : photoUrl ? (
                <img
                  src={photoUrl}
                  alt="切り抜き済み"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-center">
                  <p className="text-4xl mb-2">＋</p>
                  <p className="text-sm text-purple-300">タップして写真を選択</p>
                </div>
              )}
            </div>
            <input
              type="file"
              accept="image/*"
              ref={fileRef}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
            {!removeBgReady && (
              <p className="text-xs text-yellow-200/70 mt-1">
                ※ Remove.bg APIキー未設定。背景は除去されません
              </p>
            )}
            {error && <p className="text-xs text-red-300 mt-1">{error}</p>}
          </div>

          <div>
            <label className="block text-sm text-purple-200 mb-2">キャラ名</label>
            <input
              type="text"
              maxLength={20}
              className="w-full bg-slate-900/80 border border-purple-500/40 rounded-lg px-3 py-2"
              placeholder="例：闇の戦士タロウ"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <button
            onClick={() => canProceed && onNext({ name: name.trim(), photoUrl })}
            disabled={!canProceed}
            className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-40 rounded-lg py-3 font-bold text-lg"
          >
            {processing ? "処理中..." : "次へ"}
          </button>
        </div>
      </div>
    </div>
  );
};
