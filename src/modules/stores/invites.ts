import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { deleteUserByEmail, ensureUser, findUserByEmail, setUserPassword } from "@/modules/auth";
import { db } from "@/shared/db/client";
import { DomainError } from "@/shared/errors";
import { addStoreMember, getMembershipStoreId, OWNS_OTHER_STORE } from "./members";
import { storeInvites, stores } from "./schema";

export const INVITE_TTL_DAYS = 7;
const DAY_MS = 86_400_000;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

const emailSchema = z.email();
const passwordSchema = z.string().min(8, "a senha deve ter ao menos 8 caracteres").max(128, "senha longa demais");
const nameSchema = z.string().trim().min(1, "informe seu nome").max(80, "nome longo demais");

export type InviteView = { storeName: string; email: string; hasAccount: boolean; expiresAt: Date };

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function validation(path: string, message: string): DomainError {
  return new DomainError("VALIDATION", { issues: [{ path, message }] });
}

function validInvite(token: string, now: Date) {
  return and(eq(storeInvites.tokenHash, hashToken(token)), isNull(storeInvites.acceptedAt), gt(storeInvites.expiresAt, now));
}

/** Gera o link do dono (primeiro acesso ou nova senha). Só o último link pendente da loja vale. */
export async function createStoreInvite(
  storeId: string,
  email: string,
  createdBy: string | null,
  now: Date = new Date(),
): Promise<{ token: string; expiresAt: Date }> {
  const parsed = emailSchema.safeParse(email.trim().toLowerCase());
  if (!parsed.success) throw validation("ownerEmail", "email inválido");

  const owner = await findUserByEmail(parsed.data);
  if (owner) {
    const ownedStoreId = await getMembershipStoreId(owner.id);
    if (ownedStoreId && ownedStoreId !== storeId) throw validation("ownerEmail", OWNS_OTHER_STORE);
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + INVITE_TTL_DAYS * DAY_MS);
  await db.transaction(async (tx) => {
    await tx.delete(storeInvites).where(and(eq(storeInvites.storeId, storeId), isNull(storeInvites.acceptedAt)));
    await tx.insert(storeInvites).values({ storeId, email: parsed.data, tokenHash: hashToken(token), createdBy, expiresAt });
  });
  return { token, expiresAt };
}

async function findValidInvite(token: string, now: Date) {
  if (!TOKEN_PATTERN.test(token)) return null;
  const [row] = await db
    .select({
      id: storeInvites.id,
      storeId: storeInvites.storeId,
      email: storeInvites.email,
      expiresAt: storeInvites.expiresAt,
      storeName: stores.name,
    })
    .from(storeInvites)
    .innerJoin(stores, eq(stores.id, storeInvites.storeId))
    .where(validInvite(token, now))
    .limit(1);
  return row ?? null;
}

/** Há convite pendente e válido para este email em alguma loja? */
export async function hasPendingInviteElsewhere(email: string, now: Date = new Date()): Promise<boolean> {
  const [row] = await db
    .select({ id: storeInvites.id })
    .from(storeInvites)
    .where(and(eq(storeInvites.email, email.trim().toLowerCase()), isNull(storeInvites.acceptedAt), gt(storeInvites.expiresAt, now)))
    .limit(1);
  return row !== undefined;
}

export async function getInvite(token: string, now: Date = new Date()): Promise<InviteView | null> {
  const invite = await findValidInvite(token, now);
  if (!invite) return null;
  return {
    storeName: invite.storeName,
    email: invite.email,
    hasAccount: (await findUserByEmail(invite.email)) !== null,
    expiresAt: invite.expiresAt,
  };
}

export async function acceptStoreInvite(
  token: string,
  input: { name: string | null; password: string },
  now: Date = new Date(),
): Promise<{ email: string; storeId: string }> {
  const password = passwordSchema.safeParse(input.password);
  if (!password.success) throw validation("password", password.error.issues[0]?.message ?? "senha inválida");

  const invite = await findValidInvite(token, now);
  if (!invite) throw new DomainError("NOT_FOUND");

  const existing = await findUserByEmail(invite.email);
  if (existing) {
    const ownedStoreId = await getMembershipStoreId(existing.id);
    if (ownedStoreId && ownedStoreId !== invite.storeId) throw validation("email", OWNS_OTHER_STORE);
  }
  let name = "";
  if (!existing) {
    const parsedName = nameSchema.safeParse(input.name ?? "");
    if (!parsedName.success) throw validation("name", parsedName.error.issues[0]?.message ?? "nome inválido");
    name = parsedName.data;
  }

  // Marca como usado antes de mexer na conta: dois envios do mesmo link não criam duas contas.
  const [claimed] = await db
    .update(storeInvites)
    .set({ acceptedAt: now })
    .where(and(eq(storeInvites.id, invite.id), isNull(storeInvites.acceptedAt)))
    .returning({ id: storeInvites.id });
  if (!claimed) throw new DomainError("NOT_FOUND");

  let createdUser = false;
  try {
    if (existing) {
      // Vínculo primeiro: falha aqui não deixa senha trocada.
      await addStoreMember(invite.storeId, existing.id);
      await setUserPassword(existing.id, password.data);
    } else {
      const created = await ensureUser({ email: invite.email, password: password.data, name });
      createdUser = created.created;
      await addStoreMember(invite.storeId, created.id);
    }
  } catch (error) {
    // Desfaz o que este aceite criou e devolve o link; falha na limpeza nunca esconde o erro original.
    try {
      if (createdUser) await deleteUserByEmail(invite.email);
      await db.update(storeInvites).set({ acceptedAt: null }).where(eq(storeInvites.id, claimed.id));
    } catch {
      // ignorado de propósito
    }
    throw error;
  }
  return { email: invite.email, storeId: invite.storeId };
}
