import { isDomainError } from "@/shared/errors";

export type ActionState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string; fieldErrors: Record<string, string> };

export const idleState: ActionState = { status: "idle" };

const CHECK_FIELDS = "Confira os campos destacados.";

export function success(message: string): ActionState {
  return { status: "success", message };
}

export function fieldError(field: string, message: string): ActionState {
  return { status: "error", message: CHECK_FIELDS, fieldErrors: { [field]: message } };
}

/** Converte erros de domínio esperados em estado de formulário; erros inesperados sobem. */
export function actionError(error: unknown): ActionState {
  if (isDomainError(error) && error.code === "VALIDATION") {
    const issues = (error.details.issues ?? []) as { path: string; message: string }[];
    return {
      status: "error",
      message: CHECK_FIELDS,
      fieldErrors: Object.fromEntries(issues.map((issue) => [issue.path || "_", issue.message])),
    };
  }
  if (isDomainError(error) && error.code === "NOT_FOUND") {
    return { status: "error", message: "Item não encontrado.", fieldErrors: {} };
  }
  throw error;
}
