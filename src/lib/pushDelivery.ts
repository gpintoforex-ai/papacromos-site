import { supabase } from "./supabase";

export async function flushPushNotifications() {
  const { error } = await supabase.functions.invoke("send-push-notifications");
  if (error) {
    throw error;
  }
}

export function flushPushNotificationsInBackground() {
  flushPushNotifications().catch((error) => {
    console.error("Failed to send queued push notifications", error);
  });
}
