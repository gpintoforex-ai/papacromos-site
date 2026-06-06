import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.16";

type UserProfile = {
  id: string;
  username: string | null;
  email: string | null;
  city: string | null;
  is_blocked: boolean;
};

type StickerInfo = {
  number: number;
  name: string;
  collections: {
    name: string;
  } | null;
};

type PendingTradeRow = {
  id: string;
  from_user_id: string;
  to_user_id: string;
  delivery_method: string | null;
  note: string | null;
  created_at: string;
  pending_email_last_sent_at: string | null;
  offered_sticker: StickerInfo | StickerInfo[] | null;
  requested_sticker: StickerInfo | StickerInfo[] | null;
};

type PendingTradeItem = {
  id: string;
  senderName: string;
  senderEmail: string;
  senderCity: string;
  deliveryMethod: string;
  note: string;
  createdAt: string;
  offeredSticker: StickerInfo | null;
  requestedSticker: StickerInfo | null;
};

type EmailConfig = {
  resendApiKey: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpSecure: boolean;
  emailFrom: string;
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
const resendApiKey = Deno.env.get("RESEND_API_KEY") || "";
const cronSecret = Deno.env.get("CRON_SECRET") || "";
const smtpHost = Deno.env.get("SMTP_HOST") || "";
const smtpPort = Number(Deno.env.get("SMTP_PORT") || "587");
const smtpUser = Deno.env.get("SMTP_USER") || "";
const smtpPass = Deno.env.get("SMTP_PASS") || "";
const smtpSecure = Deno.env.get("SMTP_SECURE") === "true";
const emailFrom = Deno.env.get("EMAIL_FROM") || smtpUser || "Papa Cromos <noreply@papacromos.pt>";
const appPublicUrl = Deno.env.get("APP_PUBLIC_URL") || "https://papacromos.pt";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getAuthToken(request: Request) {
  const authorization = request.headers.get("Authorization") || "";
  return authorization.replace(/^Bearer\s+/i, "").trim();
}

function requestHasCronSecret(request: Request) {
  if (!cronSecret) return false;
  const headerSecret = request.headers.get("x-cron-secret") || "";
  const bearerSecret = getAuthToken(request);
  return headerSecret === cronSecret || bearerSecret === cronSecret;
}

async function assertAdminOrCron(request: Request) {
  if (requestHasCronSecret(request)) return;

  const token = getAuthToken(request);
  if (!token) {
    throw new Error("Sessao invalida.");
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  const { data, error } = await userClient.rpc("current_user_is_admin");
  if (error) throw error;
  if (!data) {
    throw new Error("Admin access required");
  }
}

function firstItem<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] || null : value || null;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Lisbon",
  });
}

function deliveryMethodLabel(value: string | null | undefined) {
  if (value === "correio") return "Correio";
  if (value === "outro") return "Outro";
  return "Troca presencial";
}

function stickerLabel(sticker: StickerInfo | null) {
  if (!sticker) return "Cromo";
  return `${sticker.collections?.name || "Colecao"} #${String(sticker.number).padStart(3, "0")} ${sticker.name}`;
}

async function getEmailConfig(supabase: ReturnType<typeof createClient>): Promise<EmailConfig> {
  const config: EmailConfig = {
    resendApiKey,
    smtpHost,
    smtpPort,
    smtpUser,
    smtpPass,
    smtpSecure,
    emailFrom,
  };

  const { data } = await supabase
    .from("email_settings")
    .select("smtp_host, smtp_port, smtp_user, smtp_pass, smtp_secure, email_from")
    .eq("id", true)
    .maybeSingle();

  if (data) {
    config.smtpHost = String(data.smtp_host || config.smtpHost);
    config.smtpPort = Number(data.smtp_port || config.smtpPort || 587);
    config.smtpUser = String(data.smtp_user || config.smtpUser);
    config.smtpPass = String(data.smtp_pass || config.smtpPass);
    config.smtpSecure = Boolean(data.smtp_secure);
    config.emailFrom = String(data.email_from || config.emailFrom || config.smtpUser);
  }

  return config;
}

function buildEmailHtml(recipient: UserProfile, trades: PendingTradeItem[]) {
  const recipientName = recipient.username || recipient.email?.split("@")[0] || "colecionador";
  const visibleTrades = trades.slice(0, 30);
  const hiddenCount = Math.max(0, trades.length - visibleTrades.length);

  return `
    <!doctype html>
    <html>
      <body style="margin:0;background:#e0f2fe;padding:24px 12px;font-family:Inter,Arial,sans-serif;color:#0f172a;">
        <div style="max-width:680px;margin:0 auto;background:#ffffff;border-radius:26px;overflow:hidden;box-shadow:0 20px 50px rgba(15,23,42,0.15);">
          <div style="padding:28px 24px;background:#0f172a;color:#ffffff;">
            <div style="font-size:13px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#93c5fd;">Papa Cromos</div>
            <h1 style="margin:10px 0 8px;font-size:30px;line-height:1.05;">Tens propostas de troca pendentes.</h1>
            <p style="margin:0;color:#cbd5e1;font-size:15px;line-height:1.55;">Ola ${escapeHtml(recipientName)}, ha ${escapeHtml(trades.length)} proposta${trades.length === 1 ? "" : "s"} a aguardar a tua resposta.</p>
          </div>

          <div style="padding:20px 24px 10px;">
            ${visibleTrades.map((trade) => `
              <section style="margin:0 0 14px;padding:16px;border:1px solid #e2e8f0;border-radius:18px;background:#ffffff;">
                <div style="display:block;margin:0 0 10px;">
                  <strong style="font-size:16px;color:#0f172a;">${escapeHtml(trade.senderName)}</strong>
                  <span style="display:block;margin-top:3px;color:#64748b;font-size:13px;">${escapeHtml(formatDate(trade.createdAt))}${trade.senderCity ? ` - ${escapeHtml(trade.senderCity)}` : ""} - ${escapeHtml(trade.deliveryMethod)}</span>
                </div>
                <div style="padding:12px;border-radius:14px;background:#f8fafc;border:1px solid #edf2f7;">
                  <div style="font-size:13px;color:#475569;line-height:1.5;">
                    <strong>Oferece:</strong> ${escapeHtml(stickerLabel(trade.offeredSticker))}<br>
                    <strong>Pede:</strong> ${escapeHtml(stickerLabel(trade.requestedSticker))}
                  </div>
                  ${trade.note ? `<p style="margin:10px 0 0;color:#475569;font-size:13px;line-height:1.45;">${escapeHtml(trade.note)}</p>` : ""}
                </div>
                ${trade.senderEmail ? `<a href="mailto:${escapeHtml(trade.senderEmail)}" style="display:inline-block;margin-top:10px;color:#2563eb;font-size:13px;text-decoration:none;font-weight:700;">Responder por email</a>` : ""}
              </section>
            `).join("")}

            ${hiddenCount > 0 ? `<p style="margin:8px 0 18px;color:#64748b;font-size:13px;">Mostramos as primeiras 30 propostas para manter o email leve. Ha mais ${escapeHtml(hiddenCount)} na aplicacao.</p>` : ""}
          </div>

          <div style="padding:8px 24px 28px;text-align:center;">
            <a href="${escapeHtml(appPublicUrl)}" style="display:inline-block;padding:13px 18px;border-radius:14px;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:800;">Abrir propostas</a>
            <p style="margin:14px 0 0;color:#94a3b8;font-size:12px;line-height:1.5;">Recebeste este email porque tens propostas de troca em aberto no Papa Cromos.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

function buildEmailText(recipient: UserProfile, trades: PendingTradeItem[]) {
  const recipientName = recipient.username || recipient.email?.split("@")[0] || "colecionador";
  const lines = [
    `Ola ${recipientName},`,
    "",
    `Tens ${trades.length} proposta(s) de troca pendente(s):`,
    "",
    ...trades.slice(0, 30).map((trade) => [
      `- ${trade.senderName} (${formatDate(trade.createdAt)}):`,
      `  Oferece: ${stickerLabel(trade.offeredSticker)}`,
      `  Pede: ${stickerLabel(trade.requestedSticker)}`,
      `  Metodo: ${trade.deliveryMethod}`,
      trade.senderEmail ? `  Email: ${trade.senderEmail}` : "",
      trade.note ? `  Nota: ${trade.note}` : "",
    ].filter(Boolean).join("\n")),
  ];

  if (trades.length > 30) {
    lines.push("", `Ha mais ${trades.length - 30} proposta(s) na aplicacao.`);
  }

  lines.push("", `Abrir Papa Cromos: ${appPublicUrl}`);
  return lines.join("\n");
}

async function sendEmail(config: EmailConfig, to: string, subject: string, html: string, text: string) {
  if (!config.resendApiKey) {
    if (!config.smtpHost || !config.smtpUser || !config.smtpPass || !config.emailFrom) {
      throw new Error("Missing email configuration. Configure RESEND_API_KEY or SMTP_HOST, SMTP_USER and SMTP_PASS.");
    }

    const transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPass,
      },
    });

    try {
      await transporter.sendMail({
        from: config.emailFrom,
        to,
        subject,
        html,
        text,
      });
    } catch (error) {
      throw new Error(getEmailDeliveryErrorMessage(error));
    }
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: config.emailFrom,
      to,
      subject,
      html,
      text,
    }),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }
}

function getEmailDeliveryErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("invalidcontenttype") || lowerMessage.includes("corrupt message")) {
    return "Erro SMTP de TLS/porta. Para a porta 587 deixa SSL/TLS direto desligado. Para a porta 465 liga SSL/TLS direto.";
  }

  if (lowerMessage.includes("authentication") || lowerMessage.includes("auth") || lowerMessage.includes("535")) {
    return "Erro de autenticacao SMTP. Confirma o utilizador e a password/app password.";
  }

  if (lowerMessage.includes("econnrefused") || lowerMessage.includes("etimedout") || lowerMessage.includes("enotfound")) {
    return "Nao foi possivel ligar ao servidor SMTP. Confirma o servidor, porta e firewall do fornecedor.";
  }

  return message || "Erro ao enviar email por SMTP.";
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return new Response("Missing Supabase environment variables", { status: 500, headers: corsHeaders });
    }

    await assertAdminOrCron(request);

    const payload = await request.json().catch(() => ({}));
    const force = Boolean(payload?.force);
    const cooldownHours = Math.max(1, Number(payload?.cooldownHours || 24));
    const reminderBefore = new Date(Date.now() - cooldownHours * 60 * 60 * 1000).toISOString();

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const emailConfig = await getEmailConfig(supabase);

    if (payload?.test) {
      const to = String(payload?.to || "").trim();
      if (!to || !to.includes("@")) {
        throw new Error("Email de teste invalido.");
      }

      await sendEmail(
        emailConfig,
        to,
        "Papa Cromos: teste SMTP",
        `
          <!doctype html>
          <html>
            <body style="margin:0;background:#f8fafc;padding:24px;font-family:Inter,Arial,sans-serif;color:#0f172a;">
              <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;padding:22px;">
                <h1 style="margin:0 0 8px;font-size:24px;">Teste SMTP concluido</h1>
                <p style="margin:0;color:#475569;line-height:1.5;">A configuracao de email do Papa Cromos conseguiu enviar esta mensagem.</p>
              </div>
            </body>
          </html>
        `,
        "Teste SMTP concluido. A configuracao de email do Papa Cromos conseguiu enviar esta mensagem.",
      );

      return Response.json({ sent: true, to }, { headers: corsHeaders });
    }

    let query = supabase
      .from("trade_offers")
      .select("id, from_user_id, to_user_id, delivery_method, note, created_at, pending_email_last_sent_at, offered_sticker:stickers!trade_offers_offered_sticker_id_fkey(number, name, collections(name)), requested_sticker:stickers!trade_offers_requested_sticker_id_fkey(number, name, collections(name))")
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (!force) {
      query = query.or(`pending_email_last_sent_at.is.null,pending_email_last_sent_at.lte.${reminderBefore}`);
    }

    const { data: tradeRows, error: tradesError } = await query;
    if (tradesError) throw tradesError;

    const trades = (tradeRows || []) as unknown as PendingTradeRow[];
    if (trades.length === 0) {
      return Response.json({ recipients: 0, pending_trades: 0, sent: 0, failed: 0, failed_details: [] }, { headers: corsHeaders });
    }

    const userIds = Array.from(new Set(trades.flatMap((trade) => [trade.from_user_id, trade.to_user_id])));
    const { data: profiles, error: profilesError } = await supabase
      .from("user_profiles")
      .select("id, username, email, city, is_blocked")
      .in("id", userIds);
    if (profilesError) throw profilesError;

    const profilesById = new Map(((profiles || []) as UserProfile[]).map((profile) => [profile.id, profile]));
    const tradesByRecipient = new Map<string, PendingTradeItem[]>();

    for (const trade of trades) {
      const recipient = profilesById.get(trade.to_user_id);
      const sender = profilesById.get(trade.from_user_id);
      if (!recipient?.email || recipient.is_blocked || !sender) continue;

      const current = tradesByRecipient.get(recipient.id) || [];
      current.push({
        id: trade.id,
        senderName: sender.username || sender.email?.split("@")[0] || "Colecionador",
        senderEmail: sender.email || "",
        senderCity: sender.city || "",
        deliveryMethod: deliveryMethodLabel(trade.delivery_method),
        note: trade.note || "",
        createdAt: trade.created_at,
        offeredSticker: firstItem(trade.offered_sticker),
        requestedSticker: firstItem(trade.requested_sticker),
      });
      tradesByRecipient.set(recipient.id, current);
    }

    let sent = 0;
    const sentTradeIds = new Set<string>();
    const failed: Array<{ email: string; error: string }> = [];

    for (const [recipientId, recipientTrades] of tradesByRecipient.entries()) {
      const recipient = profilesById.get(recipientId);
      if (!recipient?.email) continue;

      try {
        await sendEmail(
          emailConfig,
          recipient.email,
          `Papa Cromos: ${recipientTrades.length} proposta${recipientTrades.length === 1 ? "" : "s"} pendente${recipientTrades.length === 1 ? "" : "s"}`,
          buildEmailHtml(recipient, recipientTrades),
          buildEmailText(recipient, recipientTrades),
        );
        sent += 1;
        recipientTrades.forEach((trade) => sentTradeIds.add(trade.id));
      } catch (error) {
        failed.push({
          email: recipient.email,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (sentTradeIds.size > 0) {
      const { error: updateError } = await supabase
        .from("trade_offers")
        .update({ pending_email_last_sent_at: new Date().toISOString() })
        .in("id", Array.from(sentTradeIds));
      if (updateError) throw updateError;
    }

    return Response.json({
      recipients: tradesByRecipient.size,
      pending_trades: Array.from(tradesByRecipient.values()).reduce((total, recipientTrades) => total + recipientTrades.length, 0),
      sent,
      failed: failed.length,
      failed_details: failed.slice(0, 5),
      force,
      cooldown_hours: cooldownHours,
    }, { headers: corsHeaders });
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500, headers: corsHeaders });
  }
});
