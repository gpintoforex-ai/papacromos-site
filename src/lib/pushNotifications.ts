import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { supabase } from "./supabase";

const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY || "";

function isNativePushAvailable() {
  return Capacitor.getPlatform() !== "web";
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = `${base64String}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((character) => character.charCodeAt(0)));
}

async function setupWebPushNotifications(userId: string) {
  if (
    !import.meta.env.PROD ||
    !vapidPublicKey ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window) ||
    !window.isSecureContext
  ) {
    return () => Promise.resolve();
  }

  const permission = Notification.permission === "default"
    ? await Notification.requestPermission()
    : Notification.permission;

  if (permission !== "granted") {
    return () => Promise.resolve();
  }

  const registration = await navigator.serviceWorker.ready;
  const existingSubscription = await registration.pushManager.getSubscription();
  const subscription = existingSubscription || await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  });
  const subscriptionJson = subscription.toJSON();
  const endpoint = subscriptionJson.endpoint;
  const p256dh = subscriptionJson.keys?.p256dh;
  const auth = subscriptionJson.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    return () => Promise.resolve();
  }

  const { error } = await supabase.from("web_push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint,
      p256dh,
      auth,
      user_agent: navigator.userAgent,
      active: true,
      error_message: null,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );

  if (error) {
    console.error("Failed to save web push subscription", error);
  }

  return async () => undefined;
}

export async function setupPushNotifications(userId: string) {
  if (!userId) {
    return () => Promise.resolve();
  }

  if (!isNativePushAvailable()) {
    return setupWebPushNotifications(userId);
  }

  const registrationListener = await PushNotifications.addListener("registration", async (token) => {
    const { error } = await supabase.from("push_tokens").upsert(
      {
        user_id: userId,
        token: token.value,
        platform: Capacitor.getPlatform(),
        active: true,
        error_message: null,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "token" },
    );

    if (error) {
      console.error("Failed to save push token", error);
    }
  });

  const registrationErrorListener = await PushNotifications.addListener("registrationError", (error) => {
    console.error("Push registration failed", error);
  });

  const notificationActionListener = await PushNotifications.addListener("pushNotificationActionPerformed", () => {
    window.dispatchEvent(new CustomEvent("papa-cromos:open-notifications"));
  });

  const permission = await PushNotifications.checkPermissions();
  const permissionStatus = permission.receive === "prompt"
    ? await PushNotifications.requestPermissions()
    : permission;

  if (permissionStatus.receive === "granted") {
    if (Capacitor.getPlatform() === "android") {
      await PushNotifications.createChannel({
        id: "default",
        name: "Notificacoes",
        description: "Alertas de trocas e mensagens",
        importance: 5,
        visibility: 1,
        sound: "default",
      });
    }

    await PushNotifications.register();
  }

  return async () => {
    await registrationListener.remove();
    await registrationErrorListener.remove();
    await notificationActionListener.remove();
  };
}
