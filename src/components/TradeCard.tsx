import { useState } from "react";
import { ArrowRight, Check, RefreshCw, Send, X } from "lucide-react";
import { getAvatarColor, getAvatarInitial } from "../lib/avatar";
import { deliveryMethodLabels, type DeliveryMethod } from "../lib/trades";

interface TradeMessage {
  id: string;
  user_id: string;
  message: string;
  created_at: string;
  username?: string;
}

interface TradeCardProps {
  id: string;
  ids?: string[];
  offeredStickers: TradeSticker[];
  requestedStickers: TradeSticker[];
  proposalItems?: TradeProposalItem[];
  fromUser: string;
  fromUsername?: string;
  fromAvatarSeed?: string;
  status: string;
  isIncoming: boolean;
  currentUserId?: string;
  deliveryMethod?: DeliveryMethod;
  note?: string;
  messages?: TradeMessage[];
  onAccept?: (id: string | string[]) => void;
  onReject?: (id: string | string[]) => void;
  onCancel?: (id: string | string[]) => void;
  onComplete?: (id: string | string[]) => void;
  onSendMessage?: (id: string, message: string) => Promise<void>;
}

interface TradeSticker {
  name: string;
  number: number;
  imageUrl: string;
  rarity: string;
}

interface TradeStickerGroup extends TradeSticker {
  quantity: number;
}

interface TradeProposalItem {
  id: string;
  offeredSticker: TradeSticker;
  requestedSticker: TradeSticker;
}

const statusLabels: Record<string, { label: string; className: string }> = {
  pending: { label: "Pendente", className: "trade-status-pending" },
  accepted: { label: "Aceite", className: "trade-status-accepted" },
  rejected: { label: "Anulada", className: "trade-status-rejected" },
  completed: { label: "Concluida", className: "trade-status-completed" },
};

export default function TradeCard({
  id,
  ids,
  offeredStickers,
  requestedStickers,
  proposalItems,
  fromUser,
  fromUsername,
  fromAvatarSeed,
  status,
  isIncoming,
  currentUserId,
  deliveryMethod = "presencial",
  note = "",
  messages = [],
  onAccept,
  onReject,
  onCancel,
  onComplete,
  onSendMessage,
}: TradeCardProps) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [counterOpen, setCounterOpen] = useState(false);
  const [counterMessage, setCounterMessage] = useState("");
  const [selectedCounterIds, setSelectedCounterIds] = useState<Set<string>>(new Set());
  const s = statusLabels[status] || statusLabels.pending;
  const displayName = fromUsername || fromUser.slice(0, 8) + "...";
  const avatarSeed = fromAvatarSeed || fromUser;
  const methodLabel = deliveryMethodLabels[deliveryMethod] || deliveryMethodLabels.presencial;
  const tradeIds = ids?.length ? ids : [id];
  const tradeItems = proposalItems?.length
    ? proposalItems
    : tradeIds.map((tradeId, index) => ({
      id: tradeId,
      offeredSticker: offeredStickers[Math.min(index, offeredStickers.length - 1)],
      requestedSticker: requestedStickers[Math.min(index, requestedStickers.length - 1)],
    }));
  const selectedCounterItems = tradeItems.filter((item) => selectedCounterIds.has(item.id));

  const toggleCounterPanel = () => {
    setCounterOpen((open) => {
      const nextOpen = !open;
      if (nextOpen && selectedCounterIds.size === 0) {
        setSelectedCounterIds(new Set(tradeItems.map((item) => item.id)));
      }
      return nextOpen;
    });
  };

  const sendMessage = async () => {
    const trimmed = message.trim();
    if (!trimmed || !onSendMessage) return;

    setSending(true);
    try {
      await onSendMessage(id, trimmed);
      setMessage("");
    } finally {
      setSending(false);
    }
  };

  const sendCounterProposal = async () => {
    const trimmed = counterMessage.trim();
    if (!selectedCounterItems.length || !onSendMessage) return;
    const selectedSummary = selectedCounterItems
      .map((item) => {
        const receive = `${item.offeredSticker.name} #${String(item.offeredSticker.number).padStart(3, "0")}`;
        const deliver = `${item.requestedSticker.name} #${String(item.requestedSticker.number).padStart(3, "0")}`;
        return `recebo ${receive} e entrego ${deliver}`;
      })
      .join("; ");

    setSending(true);
    try {
      await onSendMessage(id, `Contraproposta: aceito ${selectedCounterItems.length} carta${selectedCounterItems.length === 1 ? "" : "s"} da proposta (${selectedSummary}).${trimmed ? ` ${trimmed}` : ""}`);
      setCounterMessage("");
      setCounterOpen(false);
    } finally {
      setSending(false);
    }
  };

  const toggleCounterSelection = (tradeId: string) => {
    setSelectedCounterIds((current) => {
      const next = new Set(current);
      if (next.has(tradeId)) {
        next.delete(tradeId);
      } else {
        next.add(tradeId);
      }
      return next;
    });
  };

  return (
    <div className="trade-card">
      <div className="trade-card-header">
        <span className={`trade-status ${s.className}`}>{s.label}</span>
        <div className="trade-from-info">
          <div className="trade-avatar" style={{ background: getAvatarColor(avatarSeed) }}>
            {getAvatarInitial(displayName)}
          </div>
          <span className="trade-from">
            {isIncoming ? `De: ${displayName}` : `Para: ${displayName}`}
          </span>
        </div>
      </div>
      <div className="trade-negotiation">
        <span className="trade-method">{methodLabel}</span>
        {note ? <p>{note}</p> : <p>Sem mensagem inicial.</p>}
      </div>
      <div className="trade-card-body">
        <TradeStickerList title={isIncoming ? "Recebes" : "Entregas"} stickers={offeredStickers} />
        <ArrowRight size={20} className="trade-arrow" />
        <TradeStickerList title={isIncoming ? "Entregas" : "Recebes"} stickers={requestedStickers} />
      </div>
      {status === "pending" && (
        <div className="trade-card-actions">
          <button className="btn btn-primary btn-sm" onClick={toggleCounterPanel}>
            <RefreshCw size={14} /> Contrapropor
          </button>
          <button className="btn btn-success btn-sm" onClick={() => onAccept?.(tradeIds)}>
            <Check size={14} /> Aceitar
          </button>
          <button className="btn btn-error btn-sm" onClick={() => onReject?.(tradeIds)}>
            <X size={14} /> Rejeitar
          </button>
        </div>
      )}
      {counterOpen && status === "pending" && (
        <div className="trade-counter-panel">
          <div className="trade-counter-heading">
            <strong>Cartas que aceito nesta troca</strong>
            <span>{selectedCounterItems.length}/{tradeItems.length} selecionadas</span>
          </div>
          <div className="trade-counter-options">
            {tradeItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`trade-counter-option ${selectedCounterIds.has(item.id) ? "selected" : ""}`}
                onClick={() => toggleCounterSelection(item.id)}
              >
                <span className="trade-counter-check">{selectedCounterIds.has(item.id) ? "✓" : ""}</span>
                <MiniTradeSticker title={isIncoming ? "Recebo" : "Entrego"} sticker={item.offeredSticker} />
                <ArrowRight size={16} />
                <MiniTradeSticker title={isIncoming ? "Entrego" : "Recebo"} sticker={item.requestedSticker} />
              </button>
            ))}
          </div>
          <div className="trade-counter-form">
            <input
              type="text"
              value={counterMessage}
              placeholder="Mensagem adicional opcional..."
              onChange={(event) => setCounterMessage(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") sendCounterProposal();
              }}
            />
            <button className="btn btn-primary btn-sm" type="button" onClick={sendCounterProposal} disabled={sending || selectedCounterItems.length === 0}>
              <Send size={14} /> Enviar contraproposta
            </button>
            <button className="btn btn-success btn-sm" type="button" onClick={() => onAccept?.(selectedCounterItems.map((item) => item.id))} disabled={selectedCounterItems.length === 0}>
              <Check size={14} /> Aceitar selecionadas
            </button>
          </div>
        </div>
      )}
      {(status === "accepted" || status === "completed") && (
        <div className="trade-card-actions">
          {status === "accepted" && (
            <button className="btn btn-primary btn-sm" onClick={() => onComplete?.(tradeIds)}>
              <Check size={14} /> Concluir troca
            </button>
          )}
          <button className="btn btn-error btn-sm" onClick={() => onCancel?.(tradeIds)}>
            <X size={14} /> Anular
          </button>
        </div>
      )}
      <div className="trade-chat">
        <strong>Mensagens</strong>
        <div className="trade-messages">
          {messages.length === 0 ? (
            <span className="trade-empty-message">Ainda sem mensagens.</span>
          ) : (
            messages.map((tradeMessage) => (
              <div
                key={tradeMessage.id}
                className={`trade-message ${tradeMessage.user_id === currentUserId ? "own" : ""}`}
              >
                <span>{tradeMessage.username || (tradeMessage.user_id === currentUserId ? "Tu" : "Utilizador")}</span>
                <p>{tradeMessage.message}</p>
              </div>
            ))
          )}
        </div>
        {status !== "completed" && status !== "rejected" && (
          <div className="trade-message-form">
            <input
              type="text"
              value={message}
              placeholder="Escrever mensagem..."
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") sendMessage();
              }}
            />
            <button className="btn btn-primary btn-sm" type="button" onClick={sendMessage} disabled={sending || !message.trim()}>
              <Send size={14} /> Enviar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function MiniTradeSticker({ title, sticker }: { title: string; sticker: TradeSticker }) {
  return (
    <span className="trade-counter-mini">
      <em>{title}</em>
      <img
        src={sticker.imageUrl || "/logo.png"}
        alt={sticker.name}
        onError={(event) => {
          event.currentTarget.src = "/logo.png";
        }}
      />
      <strong>{sticker.name}</strong>
    </span>
  );
}

function groupStickers(stickers: TradeSticker[]): TradeStickerGroup[] {
  const groups = new Map<string, TradeStickerGroup>();

  stickers.forEach((sticker) => {
    const key = `${sticker.number}:${sticker.name}:${sticker.imageUrl}`;
    const existing = groups.get(key);
    if (existing) {
      existing.quantity += 1;
      return;
    }
    groups.set(key, { ...sticker, quantity: 1 });
  });

  return Array.from(groups.values());
}

function TradeStickerList({ title, stickers }: { title: string; stickers: TradeSticker[] }) {
  const groupedStickers = groupStickers(stickers);

  return (
    <div className="trade-sticker-group">
      <strong>{title}</strong>
      <div className="trade-sticker-list">
        {groupedStickers.map((sticker) => (
          <div className="trade-sticker" key={`${sticker.number}:${sticker.name}:${sticker.imageUrl}`}>
            <div className="trade-sticker-image-wrap">
              <img
                src={sticker.imageUrl || "/logo.png"}
                alt={sticker.name}
                onError={(event) => {
                  event.currentTarget.src = "/logo.png";
                }}
              />
              {sticker.quantity > 1 && <span>x{sticker.quantity}</span>}
            </div>
            <span>{sticker.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
