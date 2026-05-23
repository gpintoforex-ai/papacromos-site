import { supabase } from "./supabase";

interface AuditEventInput {
  action: string;
  entityType: string;
  entityId?: string | null;
  targetUserId?: string | null;
  metadata?: Record<string, unknown>;
}

export async function logAuditEvent({
  action,
  entityType,
  entityId = null,
  targetUserId = null,
  metadata = {},
}: AuditEventInput) {
  const { error } = await supabase.rpc("write_audit_log", {
    p_action: action,
    p_entity_type: entityType,
    p_entity_id: entityId,
    p_target_user_id: targetUserId,
    p_metadata: metadata,
    p_user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
  });

  if (error) {
    console.warn("Failed to write audit log", error);
  }
}
