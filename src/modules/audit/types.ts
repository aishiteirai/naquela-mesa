export const AUDIT_ACTIONS = ["store_created", "invite_link_created", "support_session_started", "support_session_ended"] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_LABELS: Record<AuditAction, string> = {
  store_created: "Loja criada",
  invite_link_created: "Link de acesso gerado",
  support_session_started: "Acesso de suporte iniciado",
  support_session_ended: "Acesso de suporte encerrado",
};
