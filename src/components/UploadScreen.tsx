import { useRef, useState } from "react";

interface Props {
  onNext: (data: { name: string; photoUrl: string }) => void;
}

export const UploadScreen = ({ onNext }: Props) => {
  const [photoUrl, setPhotoUrl] = useState<string>("");
  const [name, setName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("画像ファイルを選択してください");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result === "string") {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const maxSize = 400;
          let { width, height } = img;
          if (width > height && width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          } else if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);
          setPhotoUrl(canvas.toDataURL("image/jpeg", 0.8));
        };
        img.src = result;
      }
    };
    reader.readAsDataURL(file);
  };

  const canProceed = !!photoUrl && name.trim().length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-purple-900 text-white p-4">
      <div className="max-w-md mx-auto">
        <h1 className="text-3xl font-bold text-center mb-2 mt-8">キャラを作る</h1>
        <p className="text-center text-purple-200 mb-8">写真と名前を入力してね</p>

        <div className="bg-slate-800/60 rounded-2xl p-6 border border-purple-500/30 space-y-4">
          <div>
            <label className="block text-sm text-purple-200 mb-2">写真</label>
            <div
              onClick={() => fileRef.current?.click()}
              className="aspect-square w-full bg-slate-900/80 border-2 border-dashed border-purple-500/40 rounded-xl flex items-center justify-center cursor-pointer overflow-hidden"
            >
              {photoUrl ? (
                <img src={photoUrl} alt="プレビュー" className="w-full h-full object-cover" />
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
            次へ
          </button>
        </div>
      </div>
    </div>
  );
};
