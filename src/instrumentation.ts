import * as Sentry from "@sentry/nextjs";
import { dropExpectedErrors } from "@/shared/sentry-filter";

export async function register() {
  if (!process.env.SENTRY_DSN) return;
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0,
    beforeSend: dropExpectedErrors,
  });
}

export const onRequestError = Sentry.captureRequestError;
