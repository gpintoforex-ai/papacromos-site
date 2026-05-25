import { useState, useEffect, useRef } from "react";
import { ArrowRight, Check, MessageCircle, RefreshCw, Send, X } from "lucide-react";
import { getAvatarColor, getAvatarInitial } from "../lib/avatar";
import { deliveryMethodLabels, type DeliveryMethod } from "../lib/trades";

interface TradeMessage {
  id: string;
  user_id: string;
  message: string;
  created_at: string;
  is_read?: boolean;
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
  unreadCount?: number;
  onToggleReadStatus?: (id: string | string[], read: boolean) => Promise<void>;
  openMessageId?: string | null;
  openModal?: boolean;
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
  unreadCount,
  onToggleReadStatus,
  openMessageId,
  openModal,
}: TradeCardProps) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [localMessages, setLocalMessages] = useState<TradeMessage[]>(messages);
  const [counterOpen, setCounterOpen] = useState(false);
  const [messageModalOpen, setMessageModalOpen] = useState(false);
  const [counterMessage, setCounterMessage] = useState("");
  const [selectedCounterIds, setSelectedCounterIds] = useState<Set<string>>(new Set());
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const messageTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => setLocalMessages(messages), [messages]);
  useEffect(() => {
    const el = messagesRef.current;
    if (el) {
      // scroll to bottom
      el.scrollTop = el.scrollHeight;
    }
  }, [localMessages, messageModalOpen]);

  // respond to external request to open modal and highlight a message
  useEffect(() => {
    if (openModal) {
      setMessageModalOpen(true);
      if (openMessageId) {
        // wait for DOM to render
        setTimeout(() => {
          const msgEl = document.querySelector(`[data-message-id=\"${openMessageId}\"]`);
          if (msgEl && msgEl instanceof HTMLElement) {
            msgEl.scrollIntoView({ behavior: "smooth", block: "center" });
          }
          // mark as read if needed
          const target = localMessages.find((m) => m.id === openMessageId);
          if (target && !target.is_read && target.user_id !== currentUserId) {
            // mark read directly
            import("../lib/supabase").then(({ supabase }) => {
              supabase
                .from("trade_messages")
                .update({ is_read: true })
                .eq("id", openMessageId)
                .then(({ error }) => {
                  if (!error) {
                    setLocalMessages((prev) => prev.map((p) => (p.id === openMessageId ? { ...p, is_read: true } : p)));
                  }
                })
                .catch((e) => console.error(e));
            });
          }
        }, 150);
      }
    }
  }, [openModal, openMessageId]);
  useEffect(() => {
    if (messageModalOpen && messageTextareaRef.current) {
      messageTextareaRef.current.focus();
    }
  }, [messageModalOpen]);
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
  const unread = unreadCount ?? 0;
  const hasOtherUserMessages = messages.some((msg) => msg.user_id !== currentUserId);
  const messagesPanelId = `trade-messages-${id}`;

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

    const tempId = `temp-${Date.now()}`;
    const tempMsg: TradeMessage = {
      id: tempId,
      user_id: currentUserId || "",
      message: trimmed,
      created_at: new Date().toISOString(),
      username: "Tu",
    };

    // optimistic UI
    setLocalMessages((cur) => [...cur, tempMsg]);
    setSending(true);
    try {
      await onSendMessage(id, trimmed);
      setMessage("");
    } catch (err) {
      // remove optimistic message on failure
      setLocalMessages((cur) => cur.filter((m) => m.id !== tempId));
      throw err;
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

    const proposalText = `Contraproposta: aceito ${selectedCounterItems.length} carta${selectedCounterItems.length === 1 ? "" : "s"} da proposta (${selectedSummary}).${trimmed ? ` ${trimmed}` : ""}`;
    const tempId = `temp-${Date.now()}`;
    const tempMsg: TradeMessage = {
      id: tempId,
      user_id: currentUserId || "",
      message: proposalText,
      created_at: new Date().toISOString(),
      username: "Tu",
    };

    setLocalMessages((cur) => [...cur, tempMsg]);
    setSending(true);
    try {
      await onSendMessage(id, proposalText);
      setCounterMessage("");
      setCounterOpen(false);
    } catch (err) {
      setLocalMessages((cur) => cur.filter((m) => m.id !== tempId));
      throw err;
    } finally {
      setSending(false);
    }
  };

  const markMessageAsRead = async (msgId: string) => {
    try {
      const target = localMessages.find((m) => m.id === msgId);
      if (!target || target.is_read || target.user_id === currentUserId) return;
      const { supabase } = await import("../lib/supabase");
      const { error } = await supabase.from("trade_messages").update({ is_read: true }).eq("id", msgId);
      if (!error) {
        setLocalMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, is_read: true } : m)));
        onToggleReadStatus?.(msgId, true);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleMessageClick = (tradeMessage: TradeMessage) => {
    if (tradeMessage.user_id !== currentUserId && !tradeMessage.is_read) {
      markMessageAsRead(tradeMessage.id);
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
      <button
        className="trade-floating-message-shortcut"
        type="button"
        onClick={() => setMessageModalOpen(true)}
        title="Abrir mensagens"
        aria-label="Abrir mensagens"
      >
        <MessageCircle size={18} />
      </button>
      <div className="trade-card-header">
        <span className={`trade-status ${s.className}`}>{s.label}</span>
        {unread > 0 && <span className="trade-unread-pill">{unread}</span>}
        <div className="trade-from-info">
          <div className="trade-avatar" style={{ background: getAvatarColor(avatarSeed) }}>
            {getAvatarInitial(displayName)}
          </div>
          <span className="trade-from">
            {isIncoming ? `De: ${displayName}` : `Para: ${displayName}`}
          </span>
        </div>
        {hasOtherUserMessages && onToggleReadStatus && (
          <button
            className={`btn btn-ghost btn-sm trade-read-toggle ${unread > 0 ? "trade-unread" : ""}`}
            type="button"
            onClick={() => onToggleReadStatus(tradeIds, unread === 0)}
          >
            {unread > 0 ? "Marcar como lida" : "Marcar como não lida"}
          </button>
        )}
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
            <div className="message-textarea-wrap">
              <MessageCircle size={15} aria-hidden="true" />
              <textarea
                value={counterMessage}
                placeholder="Mensagem adicional opcional..."
                onChange={(event) => setCounterMessage(event.target.value)}
              />
            </div>
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
      <div className="trade-chat" id={messagesPanelId}>
        <strong>Mensagens</strong>
        <div className="trade-messages">
          {localMessages.length === 0 ? (
            <span className="trade-empty-message">Ainda sem mensagens.</span>
          ) : (
            <div ref={messagesRef} className="trade-messages-list">
              {localMessages.map((tradeMessage) => (
                <div
                  key={tradeMessage.id}
                  className={`trade-message ${tradeMessage.user_id === currentUserId ? "own" : ""} ${tradeMessage.user_id !== currentUserId && !tradeMessage.is_read ? "unread" : ""}`}
                  onClick={() => handleMessageClick(tradeMessage)}
                  role={tradeMessage.user_id !== currentUserId ? "button" : undefined}
                  tabIndex={tradeMessage.user_id !== currentUserId ? 0 : undefined}
                >
                  <div className="trade-message-meta">
                    <div className="trade-message-header">
                      <span className={`trade-message-type-badge ${tradeMessage.user_id === currentUserId ? "sent" : "received"}`}>{tradeMessage.user_id === currentUserId ? "Enviada" : "Recebida"}</span>
                    </div>
                    <div className="trade-message-topline">
                      <span className="trade-message-sender">{tradeMessage.username || (tradeMessage.user_id === currentUserId ? "Tu" : "Utilizador")}</span>
                      {tradeMessage.user_id !== currentUserId && !tradeMessage.is_read && <span className="trade-message-unread-pill">Não lida</span>}
                      <time className="trade-message-time">{new Date(tradeMessage.created_at).toLocaleString()}</time>
                    </div>
                  </div>
                  <p className="trade-message-text">{tradeMessage.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        {status !== "completed" && status !== "rejected" && (
          <div className="trade-message-form">
            <div className="message-textarea-wrap">
              <MessageCircle size={15} aria-hidden="true" />
              <textarea
                value={message}
                placeholder="Escrever mensagem..."
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    sendMessage();
                  }
                }}
                ref={messageTextareaRef}
              />
            </div>
            <button className="btn btn-primary btn-sm" type="button" onClick={sendMessage} disabled={sending || !message.trim()}>
              <Send size={14} /> Enviar
            </button>
          </div>
        )}
      </div>
      {messageModalOpen && (
        <div className="trade-message-modal-overlay" role="dialog" aria-modal="true" aria-labelledby={`trade-message-modal-title-${id}`}>
          <div className="trade-message-modal">
            <div className="trade-message-modal-header">
              <div>
                <h3 id={`trade-message-modal-title-${id}`}>Mensagens</h3>
                <span>{isIncoming ? `De: ${displayName}` : `Para: ${displayName}`}</span>
              </div>
              <button className="header-icon-btn" type="button" onClick={() => setMessageModalOpen(false)} title="Fechar" aria-label="Fechar mensagens">
                <X size={18} />
              </button>
            </div>
            <div className="trade-chat trade-chat-modal">
              <div className="trade-messages">
                {localMessages.length === 0 ? (
                  <span className="trade-empty-message">Ainda sem mensagens.</span>
                ) : (
                  <div ref={messagesRef} className="trade-messages-list">
                    {localMessages.map((tradeMessage) => (
                      <div
                        key={tradeMessage.id}
                        data-message-id={tradeMessage.id}
                        className={`trade-message ${tradeMessage.user_id === currentUserId ? "own" : ""} ${tradeMessage.user_id !== currentUserId && !tradeMessage.is_read ? "unread" : ""}`}
                        onClick={() => handleMessageClick(tradeMessage)}
                        role={tradeMessage.user_id !== currentUserId ? "button" : undefined}
                        tabIndex={tradeMessage.user_id !== currentUserId ? 0 : undefined}
                      >
                        <div className="trade-message-meta">
                          <div className="trade-message-header">
                            <span className={`trade-message-type-badge ${tradeMessage.user_id === currentUserId ? "sent" : "received"}`}>{tradeMessage.user_id === currentUserId ? "Enviada" : "Recebida"}</span>
                          </div>
                          <div className="trade-message-topline">
                            <span className="trade-message-sender">{tradeMessage.username || (tradeMessage.user_id === currentUserId ? "Tu" : "Utilizador")}</span>
                            {tradeMessage.user_id !== currentUserId && !tradeMessage.is_read && <span className="trade-message-unread-pill">Não lida</span>}
                            <time className="trade-message-time">{new Date(tradeMessage.created_at).toLocaleString()}</time>
                          </div>
                        </div>
                        <p className="trade-message-text">{tradeMessage.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {status !== "completed" && status !== "rejected" && (
                <div className="trade-message-form">
                  <div className="message-textarea-wrap">
                    <MessageCircle size={15} aria-hidden="true" />
                    <textarea
                      value={message}
                      placeholder="Escrever mensagem..."
                      onChange={(event) => setMessage(event.target.value)}
                    />
                  </div>
                  <button className="btn btn-primary btn-sm" type="button" onClick={sendMessage} disabled={sending || !message.trim()}>
                    <Send size={14} /> Enviar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
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
