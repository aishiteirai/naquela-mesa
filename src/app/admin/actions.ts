"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { recordAudit } from "@/modules/audit";
import { requireSuperAdmin, startImpersonation } from "@/modules/auth";
import { createStoreFromTemplate } from "@/modules/onboarding";
import { createStoreInvite, getStoreById, getStoreOwnerUserId, storeMenuTag } from "@/modules/stores";
import { getEnv } from "@/shared/env";
import { actionError, type ActionState } from "@/app/_lib/action-state";

export type AdminLinkState = ActionState | { status: "link"; message: string; inviteUrl: string | null };

function inviteUrl(token: string): string {
  return new URL(`/convite/${token}`, getEnv().BETTER_AUTH_URL).toString();
}

function text(form: FormData, name: string): string {
  return String(form.get(name) ?? "");
}

export async function createStoreAction(_prev: AdminLinkState, form: FormData): Promise<AdminLinkState> {
  const admin = await requireSuperAdmin();
  try {
    const result = await createStoreFromTemplate(
      {
        name: text(form, "name"),
        slug: text(form, "slug"),
        whatsapp: text(form, "whatsapp"),
        ownerEmail: text(form, "ownerEmail"),
        template: text(form, "template"),
      },
      admin.id,
    );
    // Visita anterior ao slug pode ter deixado "loja não encontrada" no cache.
    updateTag(storeMenuTag(result.slug));
    await recordAudit({
      actorUserId: admin.id,
      action: "store_created",
      storeId: result.storeId,
      details: { actorEmail: admin.email, storeName: text(form, "name").trim(), storeSlug: result.slug },
    });
    return result.inviteToken
      ? { status: "link", message: "Loja criada.", inviteUrl: inviteUrl(result.inviteToken) }
      : { status: "link", message: "Loja criada e vinculada à conta existente do dono.", inviteUrl: null };
  } catch (error) {
    return actionError(error);
  }
}

export async function newInviteLinkAction(_prev: AdminLinkState, form: FormData): Promise<AdminLinkState> {
  const admin = await requireSuperAdmin();
  const storeId = z.uuid().safeParse(text(form, "storeId"));
  if (!storeId.success) return { status: "error", message: "Loja inválida.", fieldErrors: {} };
  const store = await getStoreById(storeId.data);
  if (!store) return { status: "error", message: "Loja não encontrada.", fieldErrors: {} };

  try {
    const { token } = await createStoreInvite(store.id, text(form, "email"), admin.id);
    await recordAudit({
      actorUserId: admin.id,
      action: "invite_link_created",
      storeId: store.id,
      details: { actorEmail: admin.email, storeName: store.name, storeSlug: store.slug },
    });
    return { status: "link", message: "Novo link gerado. Os anteriores deixaram de valer.", inviteUrl: inviteUrl(token) };
  } catch (error) {
    return actionError(error);
  }
}

export async function startSupportAction(form: FormData): Promise<void> {
  const admin = await requireSuperAdmin();
  const storeId = z.uuid().safeParse(text(form, "storeId"));
  if (!storeId.success) return;
  const store = await getStoreById(storeId.data);
  const ownerId = store ? await getStoreOwnerUserId(store.id) : null;
  if (!store || !ownerId) return;

  // Registra antes de trocar a sessão: o acesso fica auditado mesmo se a troca falhar depois.
  await recordAudit({
    actorUserId: admin.id,
    action: "support_session_started",
    storeId: store.id,
    details: { actorEmail: admin.email, storeName: store.name, storeSlug: store.slug },
  });
  await startImpersonation(ownerId);
  redirect("/painel");
}
