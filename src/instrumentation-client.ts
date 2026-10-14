import * as Sentry from "@sentry/nextjs";
import { dropExpectedErrors } from "@/shared/sentry-filter";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0,
    beforeSend: dropExpectedErrors,
  });
}
