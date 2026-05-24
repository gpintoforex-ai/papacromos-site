import type { ReactNode } from "react";
import { Info, Minus } from "lucide-react";

interface StickerCardProps {
  number: number;
  name: string;
  imageUrl: string;
  fallbackImageUrl?: string;
  rarity: string;
  status?: "have" | "want" | "none";
  quantity?: number;
  selected?: boolean;
  compact?: boolean;
  playerName?: string;
  cropPlayerImage?: boolean;
  wikipediaUrl?: string;
  infoAnimationKey?: string | number;
  onWikipediaClick?: () => void;
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

function vibrateOnStickerAction() {
  if ("vibrate" in navigator) {
    navigator.vibrate(35);
  }
}

export default function StickerCard({
  number,
  name,
  imageUrl,
  fallbackImageUrl,
  rarity,
  status,
  quantity,
  selected,
  compact,
  playerName,
  cropPlayerImage,
  wikipediaUrl,
  infoAnimationKey,
  onWikipediaClick,
  stickerId,
  onClick,
  onReduceQuantity,
  children,
}: StickerCardProps) {
  const r = rarityConfig[rarity] || rarityConfig.common;
  const isHave = status === "have";
  const fallbackDisplayImage = fallbackImageUrl || fallbackImage;
  const displayImage = imageUrl || fallbackDisplayImage;
  const isFallbackImage = !imageUrl;
  const isTeamPhoto = name.includes("Foto de equipa");

  return (
    <div
      className={`sticker-card ${compact ? "compact" : ""} ${selected ? "selected" : ""} ${isTeamPhoto ? "team-photo" : ""} ${cropPlayerImage ? "player-crop" : ""}`}
      data-sticker-id={stickerId}
      onClick={() => {
        if (!onClick) return;
        vibrateOnStickerAction();
        onClick();
      }}
      style={onClick ? { cursor: "pointer" } : undefined}
    >
      <div
        className={`sticker-card-image ${status === "want" ? "missing" : ""}`}
        style={{ borderColor: r.border }}
      >
        <div className="sticker-image-frame">
          <img
            className={isFallbackImage ? "sticker-fallback-logo" : undefined}
            src={displayImage}
            alt={name}
            loading="lazy"
            onError={(event) => {
              event.currentTarget.src = fallbackDisplayImage;
              event.currentTarget.classList.add("sticker-fallback-logo");
            }}
          />
        </div>
        <span className="sticker-number">
          {number}
        </span>
        {status && status !== "none" && (
          <span className={`sticker-count-badge ${isHave ? "have" : "want"} ${isHave && (quantity || 1) > 1 ? "multi" : ""}`}>
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
              vibrateOnStickerAction();
              onReduceQuantity?.();
            }}
          >
            <Minus size={15} />
          </button>
        )}
      </div>
      {playerName && (
        <div className="sticker-card-body sticker-player-name-slot">
          {(wikipediaUrl || onWikipediaClick) && (
            onWikipediaClick ? (
              <button
                className="sticker-wikipedia-link"
                key={infoAnimationKey}
                type="button"
                title={`Ver informacao de ${playerName || name} na Wikipedia`}
                aria-label={`Ver informacao de ${playerName || name} na Wikipedia`}
                onClick={(event) => {
                  event.stopPropagation();
                  onWikipediaClick();
                }}
              >
                <Info size={13} />
              </button>
            ) : (
              <a
              className="sticker-wikipedia-link"
              key={infoAnimationKey}
              href={wikipediaUrl || "#"}
              target="_blank"
              rel="noreferrer"
              title={`Pesquisar ${playerName || name} na Wikipedia`}
              aria-label={`Pesquisar ${playerName || name} na Wikipedia`}
              onClick={(event) => event.stopPropagation()}
              >
                <Info size={13} />
              </a>
            )
          )}
          <strong className="sticker-name">{playerName}</strong>
        </div>
      )}
      {children && (
        <div className="sticker-card-actions" onClick={(event) => event.stopPropagation()}>
          <span className="sticker-rarity" style={{ color: r.text, background: r.bg }}>
            {r.label}
          </span>
          {children}
        </div>
      )}
    </div>
  );
}
