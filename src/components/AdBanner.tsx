interface Props {
  position: "top" | "bottom" | "interstitial";
}

export const AdBanner = ({ position }: Props) => {
  const adClient = import.meta.env.VITE_ADSENSE_CLIENT;
  const adSlot =
    position === "top"
      ? import.meta.env.VITE_ADSENSE_SLOT_TOP
      : position === "bottom"
      ? import.meta.env.VITE_ADSENSE_SLOT_BOTTOM
      : import.meta.env.VITE_ADSENSE_SLOT_INTERSTITIAL;

  if (!adClient || !adSlot) {
    return (
      <div
        className={`w-full ${
          position === "interstitial" ? "h-64" : "h-16"
        } bg-slate-700/30 border border-slate-600/40 rounded flex items-center justify-center text-xs text-slate-400`}
      >
        広告エリア（{position}）
      </div>
    );
  }

  return (
    <ins
      className="adsbygoogle block"
      style={{ display: "block", minHeight: position === "interstitial" ? 250 : 50 }}
      data-ad-client={adClient}
      data-ad-slot={adSlot}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  );
};
