import { evaluatePassword } from "./password-policy";

export function validatePasswordReset(password: string, confirmation: string) {
  const evaluation = evaluatePassword(password);
  if (!evaluation.ok) return evaluation.message ?? "Password is invalid";
  if (password !== confirmation) return "Passwords do not match";
  return null;
}
