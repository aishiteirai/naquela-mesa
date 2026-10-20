/** Mensagem do login a partir do status HTTP do Better Auth (sem status: falha de rede). */
export function loginErrorMessage(status: number | undefined): string {
  if (status === 429) return "Muitas tentativas. Tente novamente em instantes.";
  if (status === 400 || status === 401 || status === 403) return "Email ou senha inválidos.";
  return "Não foi possível entrar agora. Tente de novo em instantes.";
}
