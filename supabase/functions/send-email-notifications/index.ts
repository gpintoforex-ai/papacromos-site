import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.16";

type EmailNotification = {
  id: string;
  user_id: string;
  subject: string;
  body: string;
  data: Record<string, unknown>;
  attempts: number;
};

type UserProfile = {
  id: string;
  username: string | null;
  email: string | null;
  is_blocked: boolean | null;
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

async function assertAuthenticatedOrCron(request: Request) {
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

  const { data, error } = await userClient.auth.getUser(token);
  if (error || !data.user) {
    throw new Error("Sessao invalida.");
  }
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

function buildEmailHtml(notification: EmailNotification, profile: UserProfile | null) {
  const recipientName =
    profile?.username ||
    profile?.email?.split("@")[0] ||
    "colecionador";
  const type = String(notification.data?.type || "");
  const actionLabel = type === "trade_message" ? "Abrir trocas" : "Abrir suporte";

  return `
    <!doctype html>
    <html>
      <body style="margin:0;background:#e0f2fe;padding:24px 12px;font-family:Inter,Arial,sans-serif;color:#0f172a;">
        <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:22px;overflow:hidden;box-shadow:0 18px 42px rgba(15,23,42,0.14);">
          <div style="padding:24px;background:#0f172a;color:#ffffff;">
            <div style="font-size:13px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#93c5fd;">Papa Cromos</div>
            <h1 style="margin:10px 0 8px;font-size:26px;line-height:1.1;">${escapeHtml(notification.subject)}</h1>
            <p style="margin:0;color:#cbd5e1;font-size:15px;line-height:1.55;">Ola ${escapeHtml(recipientName)}, tens uma nova mensagem.</p>
          </div>
          <div style="padding:22px 24px;">
            <div style="padding:16px;border:1px solid #e2e8f0;border-radius:16px;background:#f8fafc;color:#334155;font-size:15px;line-height:1.55;">
              ${escapeHtml(notification.body)}
            </div>
          </div>
          <div style="padding:0 24px 26px;text-align:center;">
            <a href="${escapeHtml(appPublicUrl)}" style="display:inline-block;padding:12px 16px;border-radius:13px;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:800;">${escapeHtml(actionLabel)}</a>
          </div>
        </div>
      </body>
    </html>
  `;
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
      await transporter.sendMail({ from: config.emailFrom, to, subject, html, text });
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

    await assertAuthenticatedOrCron(request);

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const emailConfig = await getEmailConfig(supabase);
    const { limit } = await request.json().catch(() => ({ limit: 25 }));
    const batchLimit = Math.min(100, Math.max(1, Number(limit || 25)));

    const { data, error } = await supabase
      .from("app_email_notifications")
      .select("id, user_id, subject, body, data, attempts")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(batchLimit);
    if (error) throw error;

    const notifications = (data || []) as unknown as EmailNotification[];
    const userIds = Array.from(new Set(notifications.map((notification) => notification.user_id)));
    const { data: profileRows, error: profilesError } = userIds.length > 0
      ? await supabase
        .from("user_profiles")
        .select("id, username, email, is_blocked")
        .in("id", userIds)
      : { data: [], error: null };
    if (profilesError) throw profilesError;

    const profilesById = new Map(((profileRows || []) as UserProfile[]).map((profile) => [profile.id, profile]));
    let sent = 0;
    let failed = 0;

    for (const notification of notifications) {
      const profile = profilesById.get(notification.user_id) || null;
      const to = profile?.email || "";
      if (!to || profile?.is_blocked) {
        await supabase
          .from("app_email_notifications")
          .update({
            status: "failed",
            attempts: notification.attempts + 1,
            error_message: !to ? "Recipient has no email" : "Recipient is blocked",
          })
          .eq("id", notification.id);
        failed += 1;
        continue;
      }

      try {
        await sendEmail(
          emailConfig,
          to,
          notification.subject,
          buildEmailHtml(notification, profile),
          `${notification.subject}\n\n${notification.body}\n\nAbrir Papa Cromos: ${appPublicUrl}`,
        );

        await supabase
          .from("app_email_notifications")
          .update({
            status: "sent",
            attempts: notification.attempts + 1,
            error_message: null,
            sent_at: new Date().toISOString(),
          })
          .eq("id", notification.id);
        sent += 1;
      } catch (sendError) {
        const attempts = notification.attempts + 1;
        await supabase
          .from("app_email_notifications")
          .update({
            status: attempts >= 3 ? "failed" : "pending",
            attempts,
            error_message: sendError instanceof Error ? sendError.message : String(sendError),
          })
          .eq("id", notification.id);
        failed += 1;
      }
    }

    return Response.json({ processed: notifications.length, sent, failed }, { headers: corsHeaders });
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500, headers: corsHeaders });
  }
});
