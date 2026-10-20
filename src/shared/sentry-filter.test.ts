import { describe, expect, it } from "vitest";
import { DomainError } from "./errors";
import { beforeSend, dropExpectedErrors, scrubEvent, scrubText } from "./sentry-filter";

const event = { message: "x" };

describe("dropExpectedErrors", () => {
  it("descarta erros de domínio e controles de navegação do Next", () => {
    expect(dropExpectedErrors(event, { originalException: new DomainError("STORE_CLOSED") })).toBeNull();
    expect(dropExpectedErrors(event, { originalException: Object.assign(new Error("r"), { digest: "NEXT_REDIRECT;replace;/login;307;" }) })).toBeNull();
    expect(dropExpectedErrors(event, { originalException: Object.assign(new Error("n"), { digest: "NEXT_HTTP_ERROR_FALLBACK;404" }) })).toBeNull();
    expect(dropExpectedErrors(event, { originalException: Object.assign(new Error("nf"), { digest: "NEXT_NOT_FOUND" }) })).toBeNull();
  });

  it("mantém erros inesperados", () => {
    expect(dropExpectedErrors(event, { originalException: new Error("boom") })).toBe(event);
    expect(dropExpectedErrors(event, {})).toBe(event);
  });
});

describe("scrubText", () => {
  it("remove parâmetros de query do drizzle", () => {
    expect(scrubText('Failed query: insert into "orders" ("customer_name") values ($1)\nparams: Maria Silva,+5511988887777')).toBe(
      'Failed query: insert into "orders" ("customer_name") values ($1)\nparams: [removido]',
    );
  });

  it("remove valores de violação de chave do Postgres", () => {
    expect(scrubText("Key (email)=(dono@loja.com) already exists.")).toBe("Key (email)=([removido]) already exists.");
  });

  it("troca tokens de convite e de pedido nas URLs", () => {
    expect(scrubText("https://x.app/convite/abcDEF123_-abcDEF123_-abcDEF123_-abcDEF12")).toBe("https://x.app/convite/[token]");
    expect(scrubText("/pizzaria/pedido/abcDEF123_-abcDEF123_-abcDEF123_-abcDEF12?x=1")).toBe("/pizzaria/pedido/[token]?x=1");
  });

  it("não mexe em texto comum", () => {
    expect(scrubText("TypeError: x is undefined")).toBe("TypeError: x is undefined");
  });
});

describe("scrubEvent", () => {
  it("limpa mensagem, exceções, request e breadcrumbs", () => {
    const event = {
      message: "Key (email)=(a@b.c) already exists.",
      exception: { values: [{ type: "Error", value: "Failed query: select 1\nparams: segredo" }] },
      request: { url: "https://x.app/convite/abcDEF123_-abcDEF123_-abcDEF123_-abcDEF12", data: { name: "Maria" }, query_string: "a=1", cookies: { s: "1" } },
      breadcrumbs: [{ message: "GET /p/pedido/abcDEF123_-abcDEF123_-abcDEF123_-abcDEF12", data: { url: "/p/pedido/abcDEF123_-abcDEF123_-abcDEF123_-abcDEF12" } }],
      transaction: "/convite/abcDEF123_-abcDEF123_-abcDEF123_-abcDEF12",
    };
    expect(scrubEvent(event)).toEqual({
      message: "Key (email)=([removido]) already exists.",
      exception: { values: [{ type: "Error", value: "Failed query: select 1\nparams: [removido]" }] },
      request: { url: "https://x.app/convite/[token]" },
      breadcrumbs: [{ message: "GET /p/pedido/[token]", data: { url: "/p/pedido/[token]" } }],
      transaction: "/convite/[token]",
    });
  });
});

describe("beforeSend", () => {
  it("descarta esperados e limpa o resto", () => {
    expect(beforeSend({ message: "x" }, { originalException: new DomainError("STORE_CLOSED") })).toBeNull();
    expect(beforeSend({ message: "Key (id)=(1) x" }, { originalException: new Error("boom") })).toEqual({ message: "Key (id)=([removido]) x" });
  });
});
