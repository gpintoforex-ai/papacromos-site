import type { ReactNode } from "react";
import { Minus } from "lucide-react";

interface StickerCardProps {
  number: number;
  name: string;
  imageUrl: string;
  rarity: string;
  status?: "have" | "want" | "none";
  quantity?: number;
  selected?: boolean;
  stickerId?: string;
  onClick?: () => void;
  onReduceQuantity?: () => void;
  children?: ReactNode;
}

const rarityConfig: Record<string, { label: string; bg: string; border: string; text: string }> = {
  legendary: { label: "Lendario", bg: "var(--rarity-legendary-bg)", border: "var(--rarity-legendary)", text: "var(--rarity-legendary)" },
  rare: { label: "Raro", bg: "var(--rarity-rare-bg)", border: "var(--rarity-rare)", text: "var(--rarity-rare)" },
  uncommon: { label: "Incomum", bg: "var(--rarity-uncommon-bg)", border: "var(--rarity-uncommon)", text: "var(--rarity-uncommon)" },
  common: { label: "Comum", bg: "var(--rarity-common-bg)", border: "var(--rarity-common)", text: "var(--rarity-common)" },
};

const fallbackImage = "/logo.png";

export default function StickerCard({
  number,
  name,
  imageUrl,
  rarity,
  status,
  quantity,
  selected,
  stickerId,
  onClick,
  onReduceQuantity,
  children,
}: StickerCardProps) {
  const r = rarityConfig[rarity] || rarityConfig.common;
  const isHave = status === "have";
  const displayImage = imageUrl || fallbackImage;
  const isFallbackImage = !imageUrl;

  return (
    <div
      className={`sticker-card ${selected ? "selected" : ""}`}
      data-sticker-id={stickerId}
      onClick={onClick}
      style={onClick ? { cursor: "pointer" } : undefined}
    >
      <div
        className="sticker-card-image"
        style={{ borderColor: r.border }}
      >
        <img
          className={isFallbackImage ? "sticker-fallback-logo" : undefined}
          src={displayImage}
          alt={name}
          loading="lazy"
          onError={(event) => {
            event.currentTarget.src = fallbackImage;
            event.currentTarget.classList.add("sticker-fallback-logo");
          }}
        />
        <span className="sticker-number">
          {number}
        </span>
        {status && status !== "none" && (
          <span className={`sticker-count-badge ${isHave ? "have" : "want"}`}>
            {isHave ? quantity || 1 : "0"}
          </span>
        )}
        {isHave && (
          <button
            className="sticker-minus-dot"
            type="button"
            title="Remover 1"
            onClick={(event) => {
              event.stopPropagation();
              onReduceQuantity?.();
            }}
          >
            <Minus size={15} />
          </button>
        )}
      </div>
      <div className="sticker-card-body">
        <h3 className="sticker-name">{name}</h3>
        <span className="sticker-rarity" style={{ color: r.text, background: r.bg }}>
          {r.label}
        </span>
      </div>

      {children && (
        <div className="sticker-card-actions" onClick={(event) => event.stopPropagation()}>
          {children}
        </div>
      )}
    </div>
  );
}
