import { z } from "zod";
import { findUserByEmail } from "@/modules/auth";
import { importCatalog } from "@/modules/catalog";
import { normalizeBrazilPhone } from "@/modules/orders";
import { addStoreMember, createStore, createStoreInvite, deleteStoreBySlug, getMembershipStoreId, hasPendingInviteElsewhere } from "@/modules/stores";
import { DomainError } from "@/shared/errors";
import { zodIssuesToDomainError } from "@/shared/validation";
import { STORE_TEMPLATES, TEMPLATE_FEATURES, templateCatalog } from "./templates";

export type CreateStoreFromTemplateResult = { storeId: string; slug: string; inviteToken: string | null; ownerLinked: boolean };

const inputSchema = z.object({
  name: z.string().trim().min(1, "informe o nome da loja").max(120),
  slug: z.string().trim().toLowerCase(),
  whatsapp: z.string().trim(),
  ownerEmail: z.string().trim().toLowerCase().pipe(z.email("email inválido")),
  template: z.enum(STORE_TEMPLATES, "escolha um modelo de cardápio"),
});

function validation(path: string, message: string): DomainError {
  return new DomainError("VALIDATION", { issues: [{ path, message }] });
}

/** Loja nova com o cardápio do modelo e o dono vinculado (conta existente) ou convidado (link). */
export async function createStoreFromTemplate(
  input: { name: string; slug: string; whatsapp: string; ownerEmail: string; template: string },
  createdBy: string,
): Promise<CreateStoreFromTemplateResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) throw zodIssuesToDomainError(parsed.error);
  const { name, slug, whatsapp, ownerEmail, template } = parsed.data;

  const whatsappPhone = normalizeBrazilPhone(whatsapp);
  if (!whatsappPhone) throw validation("whatsapp", "WhatsApp inválido (use DDD + número)");

  const existing = await findUserByEmail(ownerEmail);
  if (existing && (await getMembershipStoreId(existing.id))) throw validation("ownerEmail", "este email já é dono de outra loja");
  // Sem loja ainda (a loja nova nem existe): qualquer convite pendente é de outra loja.
  if (await hasPendingInviteElsewhere(ownerEmail)) throw validation("ownerEmail", "este email já é dono de outra loja");

  const { id: storeId } = await createStore({ slug, name, whatsappPhone, features: TEMPLATE_FEATURES[template] });
  try {
    await importCatalog(storeId, templateCatalog(template));
    if (existing) {
      await addStoreMember(storeId, existing.id);
      return { storeId, slug, inviteToken: null, ownerLinked: true };
    }
    const { token } = await createStoreInvite(storeId, ownerEmail, createdBy);
    return { storeId, slug, inviteToken: token, ownerLinked: false };
  } catch (error) {
    await deleteStoreBySlug(slug);
    throw error;
  }
}
