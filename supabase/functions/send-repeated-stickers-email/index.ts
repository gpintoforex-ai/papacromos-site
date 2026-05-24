import { createClient } from "npm:@supabase/supabase-js@2";

type UserProfile = {
  id: string;
  username: string | null;
  email: string | null;
  city: string | null;
  is_blocked: boolean;
};

type RepeatedStickerRow = {
  user_id: string;
  quantity: number;
  stickers: {
    number: number;
    name: string;
    collection_id: string;
    collections: {
      name: string;
    } | null;
  } | null;
};

type RepeatedStickerItem = {
  ownerName: string;
  ownerEmail: string;
  ownerCity: string;
  collectionName: string;
  stickerNumber: number;
  stickerName: string;
  availableQuantity: number;
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
const resendApiKey = Deno.env.get("RESEND_API_KEY") || "";
const emailFrom = Deno.env.get("EMAIL_FROM") || "Papa Cromos <noreply@papacromos.pt>";
const appPublicUrl = Deno.env.get("APP_PUBLIC_URL") || "https://papacromos.pt";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

async function assertAdmin(request: Request) {
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

function groupRepeatedByCollection(items: RepeatedStickerItem[]) {
  return items.reduce((groups, item) => {
    const current = groups.get(item.collectionName) || [];
    current.push(item);
    groups.set(item.collectionName, current);
    return groups;
  }, new Map<string, RepeatedStickerItem[]>());
}

function buildEmailHtml(recipient: UserProfile, repeatedItems: RepeatedStickerItem[]) {
  const recipientName = recipient.username || recipient.email?.split("@")[0] || "colecionador";
  const visibleItems = repeatedItems.slice(0, 80);
  const groupedItems = groupRepeatedByCollection(visibleItems);
  const hiddenCount = Math.max(0, repeatedItems.length - visibleItems.length);
  const totalExtras = repeatedItems.reduce((total, item) => total + item.availableQuantity, 0);

  const collectionBlocks = Array.from(groupedItems.entries()).map(([collectionName, items]) => `
    <section style="margin:0 0 18px;border:1px solid #e2e8f0;border-radius:18px;overflow:hidden;background:#ffffff;">
      <div style="padding:14px 16px;background:#f8fafc;border-bottom:1px solid #e2e8f0;">
        <h2 style="margin:0;font-size:16px;color:#0f172a;">${escapeHtml(collectionName)}</h2>
        <p style="margin:4px 0 0;color:#64748b;font-size:13px;">${items.length} cromo${items.length === 1 ? "" : "s"} repetido${items.length === 1 ? "" : "s"} nesta colecao</p>
      </div>
      <div style="padding:10px;">
        ${items.map((item) => `
          <div style="display:block;margin:0 0 8px;padding:12px;border:1px solid #edf2f7;border-radius:14px;background:#ffffff;">
            <div style="font-size:14px;color:#0f172a;font-weight:800;">#${escapeHtml(String(item.stickerNumber).padStart(3, "0"))} ${escapeHtml(item.stickerName)}</div>
            <div style="margin-top:6px;color:#475569;font-size:13px;line-height:1.45;">
              ${escapeHtml(item.ownerName)}${item.ownerCity ? ` · ${escapeHtml(item.ownerCity)}` : ""} tem <strong>${escapeHtml(item.availableQuantity)}</strong> para trocar.
            </div>
            <a href="mailto:${escapeHtml(item.ownerEmail)}" style="display:inline-block;margin-top:8px;color:#2563eb;font-size:13px;text-decoration:none;font-weight:700;">Combinar troca</a>
          </div>
        `).join("")}
      </div>
    </section>
  `).join("");

  return `
    <!doctype html>
    <html>
      <body style="margin:0;background:#e0f2fe;padding:24px 12px;font-family:Inter,Arial,sans-serif;color:#0f172a;">
        <div style="max-width:680px;margin:0 auto;background:#ffffff;border-radius:26px;overflow:hidden;box-shadow:0 20px 50px rgba(15,23,42,0.15);">
          <div style="padding:28px 24px;background:#0f172a;color:#ffffff;">
            <div style="font-size:13px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#93c5fd;">Papa Cromos</div>
            <h1 style="margin:10px 0 8px;font-size:30px;line-height:1.05;">Ha cromos repetidos prontos para saltar de caderneta.</h1>
            <p style="margin:0;color:#cbd5e1;font-size:15px;line-height:1.55;">Ola ${escapeHtml(recipientName)}, aqui vai a lista atual de repetidos registados na aplicacao.</p>
          </div>

          <div style="padding:20px 24px 10px;">
            <div style="display:block;margin:0 0 18px;padding:16px;border-radius:18px;background:#ecfeff;border:1px solid #bae6fd;">
              <strong style="display:block;font-size:20px;color:#0f172a;">${escapeHtml(totalExtras)} cromos disponiveis</strong>
              <span style="display:block;margin-top:4px;color:#475569;font-size:14px;">De ${escapeHtml(new Set(repeatedItems.map((item) => item.ownerEmail)).size)} utilizador${new Set(repeatedItems.map((item) => item.ownerEmail)).size === 1 ? "" : "es"} com repetidos.</span>
            </div>
            ${collectionBlocks || `
              <div style="padding:18px;border-radius:18px;background:#f8fafc;color:#475569;text-align:center;">
                Ainda nao ha repetidos registados para partilhar. Hoje a cola ganhou, amanha ganham as trocas.
              </div>
            `}
            ${hiddenCount > 0 ? `<p style="margin:8px 0 18px;color:#64748b;font-size:13px;">Mostramos os primeiros 80 para manter o email leve. Ha mais ${escapeHtml(hiddenCount)} na aplicacao.</p>` : ""}
          </div>

          <div style="padding:8px 24px 28px;text-align:center;">
            <a href="${escapeHtml(appPublicUrl)}" style="display:inline-block;padding:13px 18px;border-radius:14px;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:800;">Abrir Papa Cromos</a>
            <p style="margin:14px 0 0;color:#94a3b8;font-size:12px;line-height:1.5;">Recebeste este email porque tens conta registada no Papa Cromos. Responde diretamente aos colecionadores pelos contactos apresentados.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

function buildEmailText(recipient: UserProfile, repeatedItems: RepeatedStickerItem[]) {
  const recipientName = recipient.username || recipient.email?.split("@")[0] || "colecionador";
  const lines = [
    `Ola ${recipientName},`,
    "",
    "Lista atual de cromos repetidos registados no Papa Cromos:",
    "",
    ...repeatedItems.slice(0, 80).map((item) =>
      `- ${item.collectionName} #${String(item.stickerNumber).padStart(3, "0")} ${item.stickerName}: ${item.ownerName} (${item.ownerEmail}) tem x${item.availableQuantity}${item.ownerCity ? ` em ${item.ownerCity}` : ""}.`
    ),
  ];

  if (repeatedItems.length === 0) {
    lines.push("Ainda nao ha repetidos registados para partilhar.");
  }

  if (repeatedItems.length > 80) {
    lines.push("", `Ha mais ${repeatedItems.length - 80} cromos repetidos na aplicacao.`);
  }

  lines.push("", `Abrir Papa Cromos: ${appPublicUrl}`);
  return lines.join("\n");
}

async function sendEmail(to: string, subject: string, html: string, text: string) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: emailFrom,
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

    if (!resendApiKey) {
      return new Response("Missing RESEND_API_KEY environment variable", { status: 500, headers: corsHeaders });
    }

    await assertAdmin(request);

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: profiles, error: profilesError } = await supabase
      .from("user_profiles")
      .select("id, username, email, city, is_blocked")
      .eq("is_blocked", false)
      .not("email", "is", null);

    if (profilesError) throw profilesError;

    const recipients = ((profiles || []) as UserProfile[]).filter((profile) => Boolean(profile.email));
    const profilesById = new Map(recipients.map((profile) => [profile.id, profile]));

    const { data: repeatedRows, error: repeatedError } = await supabase
      .from("user_stickers")
      .select("user_id, quantity, stickers(number, name, collection_id, collections(name))")
      .eq("status", "have")
      .gt("quantity", 1)
      .order("quantity", { ascending: false });

    if (repeatedError) throw repeatedError;

    const repeatedItems = ((repeatedRows || []) as unknown as RepeatedStickerRow[])
      .map((row) => {
        const owner = profilesById.get(row.user_id);
        const sticker = row.stickers;
        if (!owner?.email || !sticker) return null;

        return {
          ownerName: owner.username || owner.email.split("@")[0] || "Colecionador",
          ownerEmail: owner.email,
          ownerCity: owner.city || "",
          collectionName: sticker.collections?.name || "Colecao",
          stickerNumber: sticker.number,
          stickerName: sticker.name,
          availableQuantity: Math.max(0, (row.quantity || 0) - 1),
        };
      })
      .filter((item): item is RepeatedStickerItem => Boolean(item && item.availableQuantity > 0))
      .sort((a, b) =>
        a.collectionName.localeCompare(b.collectionName, "pt") ||
        a.stickerNumber - b.stickerNumber ||
        a.ownerName.localeCompare(b.ownerName, "pt")
      );

    let sent = 0;
    const failed: Array<{ email: string; error: string }> = [];

    for (const recipient of recipients) {
      if (!recipient.email) continue;
      try {
        await sendEmail(
          recipient.email,
          `Papa Cromos: ${repeatedItems.length} repetidos a circular`,
          buildEmailHtml(recipient, repeatedItems),
          buildEmailText(recipient, repeatedItems),
        );
        sent += 1;
      } catch (error) {
        failed.push({
          email: recipient.email,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return Response.json({
      recipients: recipients.length,
      repeated_stickers: repeatedItems.length,
      sent,
      failed: failed.length,
      failed_details: failed.slice(0, 5),
    }, { headers: corsHeaders });
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500, headers: corsHeaders });
  }
});
