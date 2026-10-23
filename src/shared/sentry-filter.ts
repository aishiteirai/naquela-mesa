import { isDomainError } from "./errors";

const NEXT_CONTROL_DIGESTS = ["NEXT_REDIRECT", "NEXT_HTTP_ERROR_FALLBACK", "NEXT_NOT_FOUND"];

/** beforeSend do Sentry: erros esperados (regra de negócio, redirect/notFound do Next) não são incidentes. */
export function dropExpectedErrors<T>(event: T, hint: { originalException?: unknown }): T | null {
  const error = hint.originalException;
  if (isDomainError(error)) return null;
  const digest = typeof error === "object" && error !== null ? (error as { digest?: unknown }).digest : undefined;
  if (typeof digest === "string" && NEXT_CONTROL_DIGESTS.some((prefix) => digest.startsWith(prefix))) return null;
  return event;
}

const REDACTED = "[removido]";
const QUERY_PARAMS = /\nparams: [\s\S]*$/;
const KEY_VALUES = /Key \(([^)]*)\)=\([^)]*\)/g;
const URL_TOKENS = /\/(convite|pedido)\/[A-Za-z0-9_-]{20,}/g;

/** Tira dados pessoais e tokens de um texto que vai para o Sentry. */
export function scrubText(text: string): string {
  return text
    .replace(QUERY_PARAMS, `\nparams: ${REDACTED}`)
    .replace(KEY_VALUES, `Key ($1)=(${REDACTED})`)
    .replace(URL_TOKENS, "/$1/[token]");
}

type ScrubbableEvent = {
  message?: string;
  transaction?: string;
  exception?: { values?: { value?: string }[] };
  request?: { url?: string; data?: unknown; query_string?: unknown; cookies?: unknown };
  breadcrumbs?: { message?: string; data?: Record<string, unknown> }[];
};

/** Limpa um evento do Sentry: mensagens, exceções, URL e breadcrumbs; corpo, query e cookies da requisição saem. */
export function scrubEvent<T>(event: T): T {
  const copy: ScrubbableEvent = { ...(event as ScrubbableEvent) };
  if (copy.message) copy.message = scrubText(copy.message);
  if (copy.transaction) copy.transaction = scrubText(copy.transaction);
  if (copy.exception?.values) {
    copy.exception = {
      ...copy.exception,
      values: copy.exception.values.map((value) => (value.value ? { ...value, value: scrubText(value.value) } : value)),
    };
  }
  if (copy.request) {
    copy.request = copy.request.url ? { url: scrubText(copy.request.url) } : {};
  }
  if (copy.breadcrumbs) {
    copy.breadcrumbs = copy.breadcrumbs.map((crumb) => ({
      ...crumb,
      ...(crumb.message ? { message: scrubText(crumb.message) } : {}),
      ...(crumb.data
        ? {
            data: Object.fromEntries(
              Object.entries(crumb.data).map(([key, value]) => [key, typeof value === "string" ? scrubText(value) : value]),
            ),
          }
        : {}),
    }));
  }
  return copy as T;
}

/** beforeSend do Sentry: descarta o esperado e limpa o resto. */
export function beforeSend<T>(event: T, hint: { originalException?: unknown }): T | null {
  const kept = dropExpectedErrors(event, hint);
  return kept === null ? null : scrubEvent(kept);
}
