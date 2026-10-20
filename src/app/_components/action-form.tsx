"use client";

import { type ComponentProps, createContext, startTransition, useContext } from "react";

const PendingContext = createContext(false);

/** `pending` do ActionForm mais próximo; o SubmitButton usa porque `useFormStatus` só enxerga `<form action>`. */
export function useActionFormPending(): boolean {
  return useContext(PendingContext);
}

type Props = Omit<ComponentProps<"form">, "action" | "onSubmit"> & {
  /** O `formAction` devolvido por `useActionState`. */
  action: (form: FormData) => void;
  pending: boolean;
};

/**
 * `<form>` que chama a action sem o reset automático do React 19 (`<form action>` limpa os campos não
 * controlados quando a action termina, inclusive em erro): o que a pessoa digitou continua na tela.
 * Formulários que precisam limpar depois do sucesso chamam `form.reset()` por conta própria.
 */
export function ActionForm({ action, pending, children, ...props }: Props) {
  return (
    <PendingContext value={pending}>
      <form
        {...props}
        onSubmit={(event) => {
          event.preventDefault();
          if (pending) return;
          const submitter = (event.nativeEvent as SubmitEvent).submitter;
          const data = new FormData(event.currentTarget, submitter);
          startTransition(() => action(data));
        }}
      >
        {children}
      </form>
    </PendingContext>
  );
}
