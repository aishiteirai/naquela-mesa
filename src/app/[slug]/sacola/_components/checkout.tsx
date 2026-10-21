"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { ModeToggle } from "@/components/mode-toggle";
import { type FormEvent, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { OrderQuote } from "@/modules/orders";
import { paymentLabel, type Fulfillment, type PaymentMethod, type PricingContext } from "@/modules/orders/client";
import { formatBRL, parseBRLToCents } from "@/shared/money";
import { uuid } from "@/shared/uuid";
import { useCart } from "@/app/[slug]/_components/cart-context";
import { repriceCart } from "@/app/[slug]/_lib/reprice-cart";
import { closedNotice } from "@/app/[slug]/_lib/closed-notice";
import { CHECKOUT_STEPS, deliveryStepErrors, firstErrorStep, parseStepParam, type CheckoutStep } from "@/app/[slug]/_lib/checkout-steps";
import type { CheckoutError } from "@/app/[slug]/sacola/messages";
import { placeOrderAction, quoteOrderAction } from "@/app/[slug]/sacola/actions";
import { CartStep } from "./cart-step";
import { CustomerStep } from "./customer-step";
import { DeliveryStep } from "./delivery-step";
import { OrderPlaced, type Placed } from "./order-placed";
import { PaymentStep } from "./payment-step";

export type CheckoutStore = {
  slug: string;
  address: string | null;
  features: { delivery: boolean; pickup: boolean; dineIn: boolean };
  paymentMethods: { cash: boolean; cardOnDelivery: boolean; pixKey: string | null };
  deliveryFee: { strategy: "fixed"; fixedCents: number } | { strategy: "by_neighborhood" };
  minOrderCents: number;
  zones: { neighborhood: string; feeCents: number }[];
  pricing: PricingContext;
  closedMessage: string | null;
};

// Só os campos da etapa atual precisam estar válidos para avançar; o servidor revalida tudo.
function validFieldset(fieldset: HTMLFieldSetElement | null): boolean {
  if (!fieldset) return true;
  for (const element of Array.from(fieldset.elements)) {
    if ((element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) && !element.reportValidity()) return false;
  }
  return true;
}

export function Checkout({ store }: { store: CheckoutStore }) {
  const cart = useCart();
  const router = useRouter();
  const searchParams = useSearchParams();
  const step = parseStepParam(searchParams.get("etapa"));
  const stepRef = useRef<CheckoutStep>(step);
  useEffect(() => {
    stepRef.current = step;
  }, [step]);
  const closed = store.closedMessage !== null;
  // O status da loja é calculado por requisição: enquanto fechada, reconsulta para liberar na hora de abrir.
  useEffect(() => {
    if (!closed) return;
    const timer = window.setInterval(() => router.refresh(), 60_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [closed, router]);
  const fieldsets = useRef<(HTMLFieldSetElement | null)[]>([]);
  const repriced = useMemo(() => repriceCart(store.pricing, cart.lines), [store.pricing, cart.lines]);

  const fulfillments = (
    [
      ["delivery", "Delivery", store.features.delivery],
      ["pickup", "Retirada no balcão", store.features.pickup],
      ["dine_in", "Consumo no local", store.features.dineIn],
    ] as const
  )
    .filter(([, , enabled]) => enabled)
    .map(([value, label]) => [value, label] as const);
  const enabledPayments = (
    [
      ["cash", store.paymentMethods.cash],
      ["card_on_delivery", store.paymentMethods.cardOnDelivery],
      ["pix", store.paymentMethods.pixKey !== null],
    ] as const
  )
    .filter(([, enabled]) => enabled)
    .map(([value]) => value);

  const [fulfillment, setFulfillment] = useState<Fulfillment>(fulfillments[0]?.[0] ?? "pickup");
  const [payment, setPayment] = useState<PaymentMethod>(enabledPayments[0] ?? "cash");
  const effectivePayment: PaymentMethod = fulfillment === "pickup" ? "on_pickup" : payment;
  const payments = enabledPayments.map((value) => [value, paymentLabel(value, fulfillment)] as const);
  const [idempotencyKey] = useState(() => uuid());
  const [quote, setQuote] = useState<OrderQuote | null>(null);
  const [error, setError] = useState<CheckoutError | null>(null);
  const [placed, setPlaced] = useState<Placed | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstStepRender = useRef(true);
  useEffect(() => {
    if (firstStepRender.current) {
      firstStepRender.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
    headingRef.current?.focus();
  }, [step]);

  // Os avisos de "adicionado à sacola" ficam no topo e cobririam o cabeçalho das etapas.
  useEffect(() => {
    toast.dismiss();
  }, []);

  // Recarregar no meio do checkout começa de novo: os campos das etapas anteriores estão vazios.
  useEffect(() => {
    if (parseStepParam(new URLSearchParams(window.location.search).get("etapa")) !== 1) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  function goTo(target: CheckoutStep) {
    const current = stepRef.current;
    if (target === current) return;
    // Avançar empilha uma entrada (?etapa=N); voltar desempilha, então o voltar do celular anda junto.
    stepRef.current = target;
    if (target > current) window.history.pushState(null, "", `?etapa=${target}`);
    else window.history.go(target - current);
  }

  function handleError(next: CheckoutError) {
    setError(next);
    const target = firstErrorStep(next.fieldErrors);
    if (target && target < stepRef.current) goTo(target);
  }

  function buildPayload(expectedTotalCents: number | null): { payload: Record<string, unknown> } | { error: CheckoutError } {
    const form = new FormData(formRef.current!);
    const text = (key: string) => String(form.get(key) ?? "").trim();
    const changeRaw = effectivePayment === "cash" ? text("changeFor") : "";
    const changeForCents = changeRaw ? parseBRLToCents(changeRaw) : null;
    if (changeRaw && changeForCents === null) {
      return { error: { code: "VALIDATION", message: "Confira os campos destacados.", fieldErrors: { "payment.changeForCents": "valor inválido (use 100,00)" } } };
    }
    return {
      payload: {
        idempotencyKey,
        items: cart.lines.map((line) => line.input),
        fulfillment,
        customer: { name: text("name"), phone: text("phone") },
        address:
          fulfillment === "delivery"
            ? {
                street: text("street"),
                number: text("number"),
                complement: text("complement") || null,
                neighborhood: text("neighborhood"),
                city: text("city") || null,
                zipCode: text("zipCode") || null,
                reference: text("reference") || null,
              }
            : null,
        tableLabel: fulfillment === "dine_in" ? text("tableLabel") || null : null,
        payment: { method: effectivePayment, changeForCents },
        notes: text("notes") || null,
        expectedTotalCents,
        website: text("website"),
      },
    };
  }

  function review() {
    if (pending) return;
    const built = buildPayload(null);
    if ("error" in built) return handleError(built.error);
    startTransition(async () => {
      setError(null);
      const result = await quoteOrderAction(store.slug, built.payload);
      if (result.ok) setQuote(result.quote);
      else {
        setQuote(null);
        handleError(result.error);
      }
    });
  }

  function confirm() {
    if (!quote) return;
    const built = buildPayload(quote.totalCents);
    if ("error" in built) return handleError(built.error);
    startTransition(async () => {
      setError(null);
      const result = await placeOrderAction(store.slug, built.payload);
      if (result.ok) {
        cart.clear();
        setPlaced(result.placed);
        window.history.replaceState(null, "", window.location.pathname);
      } else {
        setQuote(result.error.quote ?? null);
        handleError(result.error);
      }
    });
  }

  function next() {
    if (step === 1 && cart.lines.length === 0) return;
    if (!validFieldset(fieldsets.current[step - 1] ?? null)) return;
    if (step === 2) {
      const fieldErrors = deliveryStepErrors({
        fulfillment,
        strategy: store.deliveryFee.strategy,
        neighborhood: String(new FormData(formRef.current!).get("neighborhood") ?? ""),
      });
      if (Object.keys(fieldErrors).length > 0) {
        setError({ code: "VALIDATION", message: "Confira os campos destacados.", fieldErrors });
        return;
      }
      setError(null);
    }
    goTo((step + 1) as CheckoutStep);
    if (step === 3) review();
  }

  if (placed) return <OrderPlaced placed={placed} />;

  if (cart.ready && cart.lines.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 px-4 py-16 text-center">
        <h1 className="text-xl font-bold">Sua sacola</h1>
        <p className="text-muted-foreground">Sua sacola está vazia.</p>
        <Button asChild>
          <Link href={`/${store.slug}`}>Voltar ao cardápio</Link>
        </Button>
      </div>
    );
  }

  // Recálculo no cliente com o cardápio atual para avisar já na sacola; o servidor confere o mínimo de novo ao revisar.
  const missingForMinCents = cart.ready ? Math.max(0, store.minOrderCents - repriced.subtotalCents) : 0;
  const fieldError = (path: string) => error?.fieldErrors[path];
  const invalidateQuote = () => setQuote(null);

  return (
    <form
      ref={formRef}
      onSubmit={(event: FormEvent) => event.preventDefault()}
      onChange={() => {
        // Na etapa 4 só mudam pagamento/troco/observação, que não alteram o total; confirmar revalida no servidor.
        if (stepRef.current < 4) setQuote(null);
      }}
      className="flex flex-1 flex-col"
    >
      <header className="sticky top-0 z-10 border-b bg-background">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3">
          {step > 1 ? (
            <Button type="button" variant="ghost" size="icon" aria-label="Voltar" onClick={() => goTo((step - 1) as CheckoutStep)}>
              <ArrowLeftIcon />
            </Button>
          ) : (
            <Button asChild variant="ghost" size="icon">
              <Link href={`/${store.slug}`} aria-label="Voltar ao cardápio">
                <ArrowLeftIcon />
              </Link>
            </Button>
          )}
          <h1 ref={headingRef} tabIndex={-1} className="flex-1 text-lg font-semibold outline-none">{CHECKOUT_STEPS[step - 1]}</h1>
          <span className="text-sm text-muted-foreground">{step} de 4</span>
          <ModeToggle />
        </div>
        <div aria-hidden="true" className="mx-auto flex max-w-2xl gap-1 px-4 pb-3">
          {[1, 2, 3, 4].map((position) => (
            <span key={position} className={cn("h-1 flex-1 rounded-full", position <= step ? "bg-primary" : "bg-muted")} />
          ))}
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4">
        {store.closedMessage !== null && (
          <Alert data-testid="store-closed">
            <AlertDescription>{closedNotice(store.closedMessage)}</AlertDescription>
          </Alert>
        )}
        <CartStep ref={(element) => { fieldsets.current[0] = element; }} hidden={step !== 1} slug={store.slug} lines={repriced.lines} onCartChange={invalidateQuote} />
        {step === 1 && missingForMinCents > 0 && (
          <Alert data-testid="min-order-notice">
            <AlertDescription>
              Pedido mínimo de {formatBRL(store.minOrderCents)} (sem a entrega). Faltam {formatBRL(missingForMinCents)}.
            </AlertDescription>
          </Alert>
        )}
        <DeliveryStep
          ref={(element) => { fieldsets.current[1] = element; }}
          hidden={step !== 2}
          store={store}
          fulfillments={fulfillments}
          fulfillment={fulfillment}
          onFulfillmentChange={(value) => {
            invalidateQuote();
            setFulfillment(value);
          }}
          fieldError={fieldError}
        />
        <CustomerStep ref={(element) => { fieldsets.current[2] = element; }} hidden={step !== 3} fieldError={fieldError} />
        <PaymentStep
          ref={(element) => { fieldsets.current[3] = element; }}
          hidden={step !== 4}
          payments={payments}
          payment={payment}
          fulfillment={fulfillment}
          onPaymentChange={setPayment}
          pixKey={store.paymentMethods.pixKey}
          quote={quote}
          fieldError={fieldError}
        />

        {/* Honeypot: invisível para pessoas, bots costumam preencher. */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 overflow-hidden">
          <label>
            Site
            <input name="website" tabIndex={-1} autoComplete="off" />
          </label>
        </div>

        {error && (
          <Alert variant="destructive" data-testid="checkout-error">
            <AlertDescription className="flex flex-col gap-2">
              {error.message}
              {["BELOW_MIN_ORDER", "ITEM_UNAVAILABLE", "INVALID_OPTIONS"].includes(error.code) && (
                <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => goTo(1)}>
                  Voltar à sacola
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}
      </div>

      <footer className="sticky bottom-0 border-t bg-background">
        <div className="mx-auto flex max-w-2xl items-center gap-4 px-4 py-3">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">{step === 4 && quote ? "Total" : "Subtotal"}</span>
            <span data-testid={step === 4 && quote ? "quote-total" : undefined} className="font-semibold">
              {formatBRL(step === 4 && quote ? quote.totalCents : repriced.subtotalCents)}
            </span>
          </div>
          {step < 4 ? (
            <Button type="button" size="lg" className="flex-1" onClick={next} disabled={!cart.ready || cart.lines.length === 0 || store.closedMessage !== null || (step === 1 && (missingForMinCents > 0 || repriced.hasProblems))}>
              Continuar
            </Button>
          ) : quote ? (
            <Button type="button" size="lg" className="flex-1" onClick={confirm} disabled={pending}>
              Confirmar pedido
            </Button>
          ) : (
            <Button type="button" size="lg" className="flex-1" onClick={review} disabled={pending || !cart.ready || store.closedMessage !== null}>
              {pending ? "Calculando..." : "Revisar pedido"}
            </Button>
          )}
        </div>
      </footer>
    </form>
  );
}
