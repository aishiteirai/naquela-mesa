import { dropExpectedErrors } from "@/shared/sentry-filter";

type CaptureRequestError = typeof import("@sentry/nextjs").captureRequestError;

export async function register() {
  if (!process.env.SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0,
    beforeSend: dropExpectedErrors,
  });
}

export async function onRequestError(...args: Parameters<CaptureRequestError>) {
  if (!process.env.SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  return Sentry.captureRequestError(...args);
}
