import { useEffect, useMemo, useState } from "react";
import { LifeBuoy, MessageSquare, RefreshCw, Send } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";

interface SupportTicket {
  id: string;
  user_id: string;
  subject: string;
  status: "open" | "answered" | "closed";
  created_at: string;
  updated_at: string;
  username?: string;
  email?: string | null;
}

interface SupportMessage {
  id: string;
  ticket_id: string;
  user_id: string;
  message: string;
  created_at: string;
  username?: string;
  is_admin?: boolean;
}

const statusLabels: Record<SupportTicket["status"], string> = {
  open: "Aberto",
  answered: "Respondido",
  closed: "Fechado",
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SupportPage() {
  const { user, profile } = useAuth();
  const isAdmin = Boolean(profile?.is_admin);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [newTicketMessage, setNewTicketMessage] = useState("");
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadSupport();
  }, [user?.id, profile?.is_admin]);

  const selectedTicket = tickets.find((ticket) => ticket.id === selectedTicketId) || tickets[0] || null;

  useEffect(() => {
    if (!selectedTicketId && tickets.length > 0) {
      setSelectedTicketId(tickets[0].id);
    }
  }, [tickets, selectedTicketId]);

  const selectedMessages = useMemo(() => {
    if (!selectedTicket) return [];
    return messages.filter((message) => message.ticket_id === selectedTicket.id);
  }, [messages, selectedTicket]);

  const loadSupport = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!user?.id) {
        setTickets([]);
        setMessages([]);
        return;
      }

      const ticketQuery = supabase
        .from("support_tickets")
        .select("id, user_id, subject, status, created_at, updated_at")
        .order("updated_at", { ascending: false });

      const { data: ticketRows, error: ticketsError } = isAdmin
        ? await ticketQuery
        : await ticketQuery.eq("user_id", user.id);
      if (ticketsError) throw ticketsError;

      const loadedTickets = (ticketRows || []) as SupportTicket[];
      const ticketIds = loadedTickets.map((ticket) => ticket.id);
      const userIds = Array.from(new Set(loadedTickets.map((ticket) => ticket.user_id)));

      let loadedMessages: SupportMessage[] = [];
      if (ticketIds.length > 0) {
        const { data: messageRows, error: messagesError } = await supabase
          .from("support_ticket_messages")
          .select("id, ticket_id, user_id, message, created_at")
          .in("ticket_id", ticketIds)
          .order("created_at", { ascending: true });
        if (messagesError) throw messagesError;
        loadedMessages = (messageRows || []) as SupportMessage[];
        loadedMessages.forEach((message) => userIds.push(message.user_id));
      }

      const profilesById = new Map<string, { username?: string; email?: string | null; is_admin?: boolean }>();
      const uniqueUserIds = Array.from(new Set(userIds)).filter(Boolean);
      if (uniqueUserIds.length > 0) {
        const { data: profileRows, error: profilesError } = await supabase
          .from("user_profiles")
          .select("id, username, email, is_admin")
          .in("id", uniqueUserIds);
        if (profilesError) throw profilesError;

        (profileRows || []).forEach((row: any) => {
          profilesById.set(row.id, row);
        });
      }

      setTickets(
        loadedTickets.map((ticket) => ({
          ...ticket,
          username: profilesById.get(ticket.user_id)?.username || "Utilizador",
          email: profilesById.get(ticket.user_id)?.email || null,
        }))
      );
      setMessages(
        loadedMessages.map((message) => ({
          ...message,
          username: profilesById.get(message.user_id)?.username || "Utilizador",
          is_admin: Boolean(profilesById.get(message.user_id)?.is_admin),
        }))
      );
    } catch (err: any) {
      setError(err.message || "Erro ao carregar suporte.");
    } finally {
      setLoading(false);
    }
  };

  const createTicket = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      if (!user?.id) throw new Error("Sessao expirada. Entra novamente.");
      const cleanSubject = subject.trim();
      const cleanMessage = newTicketMessage.trim();
      if (!cleanSubject || !cleanMessage) throw new Error("Preenche o assunto e a mensagem.");

      const { data: ticket, error: ticketError } = await supabase
        .from("support_tickets")
        .insert({ user_id: user.id, subject: cleanSubject, status: "open" })
        .select("id")
        .single();
      if (ticketError) throw ticketError;

      const { error: messageError } = await supabase.from("support_ticket_messages").insert({
        ticket_id: ticket.id,
        user_id: user.id,
        message: cleanMessage,
      });
      if (messageError) throw messageError;

      setSubject("");
      setNewTicketMessage("");
      setSelectedTicketId(ticket.id);
      setSuccess("Ticket enviado ao administrador.");
      await loadSupport();
    } catch (err: any) {
      setError(err.message || "Erro ao criar ticket.");
    } finally {
      setSaving(false);
    }
  };

  const sendReply = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedTicket) return;

    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      if (!user?.id) throw new Error("Sessao expirada. Entra novamente.");
      const cleanReply = reply.trim();
      if (!cleanReply) throw new Error("Escreve uma resposta.");

      const { error: messageError } = await supabase.from("support_ticket_messages").insert({
        ticket_id: selectedTicket.id,
        user_id: user.id,
        message: cleanReply,
      });
      if (messageError) throw messageError;

      const nextStatus: SupportTicket["status"] = isAdmin ? "answered" : "open";
      const { error: ticketError } = await supabase
        .from("support_tickets")
        .update({ status: nextStatus })
        .eq("id", selectedTicket.id);
      if (ticketError) throw ticketError;

      setReply("");
      setSuccess(isAdmin ? "Resposta enviada ao utilizador." : "Resposta enviada ao administrador.");
      await loadSupport();
    } catch (err: any) {
      setError(err.message || "Erro ao enviar resposta.");
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (ticket: SupportTicket, status: SupportTicket["status"]) => {
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const { error: statusError } = await supabase
        .from("support_tickets")
        .update({ status })
        .eq("id", ticket.id);
      if (statusError) throw statusError;

      setSuccess(status === "closed" ? "Ticket fechado." : "Ticket reaberto.");
      await loadSupport();
    } catch (err: any) {
      setError(err.message || "Erro ao atualizar ticket.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="loading">A carregar suporte...</div>;

  return (
    <div className="support-page">
      <div className="support-header">
        <div>
          <h2>Suporte</h2>
          <p>{isAdmin ? "Responde aos tickets enviados pelos utilizadores." : "Envia um ticket ao administrador."}</p>
        </div>
        <button className="btn btn-ghost" type="button" onClick={loadSupport} disabled={saving}>
          <RefreshCw size={16} /> Atualizar
        </button>
      </div>

      {error && <p className="error-message">{error}</p>}
      {success && <p className="support-success">{success}</p>}

      <div className="support-grid">
        {!isAdmin && (
          <section className="support-panel">
            <div className="support-panel-title">
              <LifeBuoy size={18} />
              <h3>Novo ticket</h3>
            </div>
            <form className="support-form" onSubmit={createTicket}>
              <label>
                Assunto
                <input
                  type="text"
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder="Ex.: Problema numa troca"
                  maxLength={120}
                  required
                />
              </label>
              <label>
                Mensagem
                <textarea
                  value={newTicketMessage}
                  onChange={(event) => setNewTicketMessage(event.target.value)}
                  placeholder="Descreve o problema com o máximo de detalhe útil."
                  rows={5}
                  required
                />
              </label>
              <button className="btn btn-primary" type="submit" disabled={saving}>
                <Send size={16} /> Enviar ticket
              </button>
            </form>
          </section>
        )}

        <section className="support-panel support-ticket-list-panel">
          <div className="support-panel-title">
            <MessageSquare size={18} />
            <h3>{isAdmin ? "Tickets recebidos" : "Os meus tickets"}</h3>
          </div>
          <div className="support-ticket-list">
            {tickets.map((ticket) => (
              <button
                key={ticket.id}
                className={`support-ticket-row ${selectedTicket?.id === ticket.id ? "active" : ""}`}
                type="button"
                onClick={() => setSelectedTicketId(ticket.id)}
              >
                <span className={`support-status support-status-${ticket.status}`}>{statusLabels[ticket.status]}</span>
                <strong>{ticket.subject}</strong>
                {isAdmin && <em>{ticket.username} {ticket.email ? `- ${ticket.email}` : ""}</em>}
                <small>{formatDate(ticket.updated_at)}</small>
              </button>
            ))}
            {tickets.length === 0 && <p className="muted-text">Ainda nao ha tickets.</p>}
          </div>
        </section>

        <section className="support-panel support-conversation-panel">
          {selectedTicket ? (
            <>
              <div className="support-conversation-header">
                <div>
                  <span className={`support-status support-status-${selectedTicket.status}`}>
                    {statusLabels[selectedTicket.status]}
                  </span>
                  <h3>{selectedTicket.subject}</h3>
                  {isAdmin && <p>{selectedTicket.username} {selectedTicket.email ? `- ${selectedTicket.email}` : ""}</p>}
                </div>
                <button
                  className="btn btn-ghost btn-sm"
                  type="button"
                  onClick={() => updateStatus(selectedTicket, selectedTicket.status === "closed" ? "open" : "closed")}
                  disabled={saving}
                >
                  {selectedTicket.status === "closed" ? "Reabrir" : "Fechar"}
                </button>
              </div>

              <div className="support-message-list">
                {selectedMessages.map((message) => (
                  <article
                    key={message.id}
                    className={`support-message ${message.user_id === user?.id ? "own" : ""} ${message.is_admin ? "admin" : ""}`}
                  >
                    <div>
                      <strong>{message.is_admin ? "Administrador" : message.username}</strong>
                      <span>{formatDate(message.created_at)}</span>
                    </div>
                    <p>{message.message}</p>
                  </article>
                ))}
              </div>

              {selectedTicket.status !== "closed" ? (
                <form className="support-reply-form" onSubmit={sendReply}>
                  <textarea
                    value={reply}
                    onChange={(event) => setReply(event.target.value)}
                    placeholder={isAdmin ? "Escreve a resposta ao utilizador." : "Acrescenta mais informacao ao ticket."}
                    rows={4}
                    required
                  />
                  <button className="btn btn-primary" type="submit" disabled={saving}>
                    <Send size={16} /> Responder
                  </button>
                </form>
              ) : (
                <p className="muted-text">Este ticket esta fechado.</p>
              )}
            </>
          ) : (
            <div className="empty-state support-empty">
              <span className="empty-icon">?</span>
              <h3>Sem ticket selecionado</h3>
              <p>Seleciona um ticket para ver a conversa.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
