import { createClient } from "npm:@supabase/supabase-js@2";
// @deno-types="npm:@types/web-push@3.6.4"
import webPush from "npm:web-push@3.6.7";

type ServiceAccount = {
  client_email: string;
  private_key: string;
  project_id?: string;
};

type AppNotification = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  attempts: number;
};

type PushToken = {
  id: string;
  token: string;
};

type WebPushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const serviceAccountJson = Deno.env.get("FCM_SERVICE_ACCOUNT_JSON") || "";
const fcmProjectId = Deno.env.get("FCM_PROJECT_ID") || "";
const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@papacromos.pt";
const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY") || "";

const supabase = createClient(supabaseUrl, serviceRoleKey);

if (vapidPublicKey && vapidPrivateKey) {
  webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

function base64Url(input: string | ArrayBuffer) {
  const bytes = typeof input === "string"
    ? new TextEncoder().encode(input)
    : new Uint8Array(input);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function pemToArrayBuffer(pem: string) {
  const base64 = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

async function createAccessToken(serviceAccount: ServiceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const signingInput = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(serviceAccount.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    new TextEncoder().encode(signingInput),
  );
  const assertion = `${signingInput}.${base64Url(signature)}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to obtain FCM access token: ${await response.text()}`);
  }

  const json = await response.json();
  return json.access_token as string;
}

function stringifyData(data: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(data || {}).map(([key, value]) => [key, typeof value === "string" ? value : JSON.stringify(value)]),
  );
}

async function sendToToken(
  accessToken: string,
  projectId: string,
  token: string,
  notification: AppNotification,
) {
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        token,
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: stringifyData(notification.data),
        android: {
          priority: "HIGH",
          notification: {
            channel_id: "default",
          },
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }
}

async function sendToWebSubscription(subscription: WebPushSubscriptionRow, notification: AppNotification) {
  await webPush.sendNotification(
    {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    },
    JSON.stringify({
      title: notification.title,
      body: notification.body,
      data: notification.data,
    }),
  );
}

Deno.serve(async () => {
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response("Missing push notification environment variables", { status: 500 });
  }

  const serviceAccount = serviceAccountJson ? JSON.parse(serviceAccountJson) as ServiceAccount : null;
  const projectId = serviceAccount ? fcmProjectId || serviceAccount.project_id : "";
  const canSendNativePush = Boolean(serviceAccount && projectId);
  const canSendWebPush = Boolean(vapidPublicKey && vapidPrivateKey);

  if (!canSendNativePush && !canSendWebPush) {
    return new Response("Missing FCM or Web Push credentials", { status: 500 });
  }

  const { data: notifications, error: notificationError } = await supabase
    .from("app_notifications")
    .select("id, user_id, title, body, data, attempts")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(25);

  if (notificationError) {
    return new Response(notificationError.message, { status: 500 });
  }

  const accessToken = canSendNativePush && serviceAccount ? await createAccessToken(serviceAccount) : "";
  let sent = 0;
  let failed = 0;

  for (const notification of (notifications || []) as AppNotification[]) {
    const errors: string[] = [];
    let targetCount = 0;
    let deliveredCount = 0;

    const { data: tokens, error: tokenError } = await supabase
      .from("push_tokens")
      .select("id, token")
      .eq("user_id", notification.user_id)
      .eq("active", true);

    if (tokenError) {
      errors.push(tokenError.message);
    } else if (canSendNativePush) {
      const userTokens = (tokens || []) as PushToken[];
      targetCount += userTokens.length;
      for (const pushToken of userTokens) {
        try {
          await sendToToken(accessToken, projectId, pushToken.token, notification);
          deliveredCount += 1;
        } catch (error) {
          errors.push(error instanceof Error ? error.message : String(error));
        }
      }
    }

    const { data: webSubscriptions, error: webSubscriptionError } = await supabase
      .from("web_push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", notification.user_id)
      .eq("active", true);

    if (webSubscriptionError) {
      errors.push(webSubscriptionError.message);
    } else if (canSendWebPush) {
      const subscriptions = (webSubscriptions || []) as WebPushSubscriptionRow[];
      targetCount += subscriptions.length;
      for (const subscription of subscriptions) {
        try {
          await sendToWebSubscription(subscription, notification);
          deliveredCount += 1;
        } catch (error) {
          errors.push(error instanceof Error ? error.message : String(error));
        }
      }
    }

    if (targetCount === 0) {
      failed += 1;
      await supabase
        .from("app_notifications")
        .update({ attempts: notification.attempts + 1, status: "failed", error_message: "No active push target" })
        .eq("id", notification.id);
    } else if (deliveredCount === 0) {
      failed += 1;
      await supabase
        .from("app_notifications")
        .update({
          attempts: notification.attempts + 1,
          status: notification.attempts >= 2 ? "failed" : "pending",
          error_message: errors.join("\n").slice(0, 2000),
        })
        .eq("id", notification.id);
    } else {
      sent += 1;
      await supabase
        .from("app_notifications")
        .update({ attempts: notification.attempts + 1, status: "sent", sent_at: new Date().toISOString(), error_message: null })
        .eq("id", notification.id);
    }
  }

  return Response.json({ processed: notifications?.length || 0, sent, failed });
});
