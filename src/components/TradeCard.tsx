import { useState } from "react";
import { ArrowRight, Check, Send, X } from "lucide-react";
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
  offeredSticker: { name: string; number: number; imageUrl: string; rarity: string };
  requestedSticker: { name: string; number: number; imageUrl: string; rarity: string };
  fromUser: string;
  fromUsername?: string;
  fromAvatarSeed?: string;
  status: string;
  isIncoming: boolean;
  currentUserId?: string;
  deliveryMethod?: DeliveryMethod;
  note?: string;
  messages?: TradeMessage[];
  onAccept?: (id: string) => void;
  onReject?: (id: string) => void;
  onCancel?: (id: string) => void;
  onComplete?: (id: string) => void;
  onSendMessage?: (id: string, message: string) => Promise<void>;
}

const statusLabels: Record<string, { label: string; className: string }> = {
  pending: { label: "Pendente", className: "trade-status-pending" },
  accepted: { label: "Aceite", className: "trade-status-accepted" },
  rejected: { label: "Anulada", className: "trade-status-rejected" },
  completed: { label: "Concluida", className: "trade-status-completed" },
};

export default function TradeCard({
  id,
  offeredSticker,
  requestedSticker,
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
  const s = statusLabels[status] || statusLabels.pending;
  const displayName = fromUsername || fromUser.slice(0, 8) + "...";
  const avatarSeed = fromAvatarSeed || fromUser;
  const methodLabel = deliveryMethodLabels[deliveryMethod] || deliveryMethodLabels.presencial;

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
        <div className="trade-sticker">
          <img src={offeredSticker.imageUrl} alt={offeredSticker.name} />
          <span>{offeredSticker.name}</span>
        </div>
        <ArrowRight size={20} className="trade-arrow" />
        <div className="trade-sticker">
          <img src={requestedSticker.imageUrl} alt={requestedSticker.name} />
          <span>{requestedSticker.name}</span>
        </div>
      </div>
      {isIncoming && status === "pending" && (
        <div className="trade-card-actions">
          <button className="btn btn-success btn-sm" onClick={() => onAccept?.(id)}>
            <Check size={14} /> Aceitar
          </button>
          <button className="btn btn-error btn-sm" onClick={() => onReject?.(id)}>
            <X size={14} /> Rejeitar
          </button>
        </div>
      )}
      {(status === "accepted" || status === "completed") && (
        <div className="trade-card-actions">
          {status === "accepted" && (
            <button className="btn btn-primary btn-sm" onClick={() => onComplete?.(id)}>
              <Check size={14} /> Concluir troca
            </button>
          )}
          <button className="btn btn-error btn-sm" onClick={() => onCancel?.(id)}>
            <X size={14} /> Anular
          </button>
        </div>
      )}
      {status === "pending" && !isIncoming && (
        <div className="trade-card-actions">
          <button className="btn btn-error btn-sm" onClick={() => onCancel?.(id)}>
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
