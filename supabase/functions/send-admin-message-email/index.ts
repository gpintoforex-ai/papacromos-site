import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.16";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
const smtpHost = Deno.env.get("SMTP_HOST") || "";
const smtpPort = Number(Deno.env.get("SMTP_PORT") || "587");
const smtpUser = Deno.env.get("SMTP_USER") || "";
const smtpPass = Deno.env.get("SMTP_PASS") || "";
const smtpSecure = Deno.env.get("SMTP_SECURE") === "true";
const emailFrom = Deno.env.get("EMAIL_FROM") || smtpUser;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function getAuthToken(request: Request) {
  const authorization = request.headers.get("Authorization") || "";
  return authorization.replace(/^Bearer\s+/i, "").trim();
}

async function assertAdmin(request: Request) {
  const token = getAuthToken(request);
  if (!token) throw new Error("Sessao invalida.");

  const userClient = createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  const { data, error } = await userClient.rpc("current_user_is_admin");
  if (error) throw error;
  if (!data) throw new Error("Admin access required");
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    await assertAdmin(request);

    if (!smtpHost || !smtpUser || !smtpPass || !emailFrom) {
      return new Response("Missing SMTP configuration", { status: 500, headers: corsHeaders });
    }

    const payload = await request.json();
    const to = String(payload?.to || "").trim();
    const subject = String(payload?.subject || "").trim();
    const message = String(payload?.message || "").trim();

    if (!to || !to.includes("@")) throw new Error("Email de destino invalido.");
    if (!subject) throw new Error("Assunto em falta.");
    if (!message) throw new Error("Mensagem em falta.");

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    await transporter.sendMail({
      from: emailFrom,
      to,
      subject,
      text: message,
      html: message
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br>"),
    });

    return Response.json({ sent: true }, { headers: corsHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao enviar email.";
    return Response.json({ error: message }, { status: 400, headers: corsHeaders });
  }
});
