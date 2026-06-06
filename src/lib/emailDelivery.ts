import { supabase } from "./supabase";

export function flushEmailNotificationsInBackground() {
  supabase.functions.invoke("send-email-notifications", {
    body: { limit: 25 },
  }).catch((error) => {
    console.warn("Failed to flush email notifications", error);
  });
}
