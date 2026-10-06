export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

const COMMON = new Set([
  "password",
  "password1",
  "password1!",
  "password123",
  "password123!",
  "12345678",
  "123456789",
  "qwerty123",
  "qwerty123!",
  "letmein1",
  "welcome1",
  "admin123",
  "admin123!",
  "iloveyou1",
  "abc12345",
  "changeme1",
  "passw0rd",
  "passw0rd!",
]);

export type PasswordChecks = {
  minLength: boolean;
  maxLength: boolean;
  hasLower: boolean;
  hasUpper: boolean;
  hasDigit: boolean;
  hasSymbol: boolean;
  notCommon: boolean;
};

export type PasswordStrength = "weak" | "fair" | "strong";

export type PasswordEvaluation = {
  ok: boolean;
  checks: PasswordChecks;
  strength: PasswordStrength;
  message: string | null;
};

const SYMBOL_RE = /[^A-Za-z0-9\s]/;

export function evaluatePassword(password: string): PasswordEvaluation {
  const checks: PasswordChecks = {
    minLength: password.length >= PASSWORD_MIN,
    maxLength: password.length <= PASSWORD_MAX && password.length > 0,
    hasLower: /[a-z]/.test(password),
    hasUpper: /[A-Z]/.test(password),
    hasDigit: /\d/.test(password),
    hasSymbol: SYMBOL_RE.test(password),
    notCommon: !COMMON.has(password.toLowerCase()),
  };
  const ok = Object.values(checks).every(Boolean);
  let message: string | null = null;
  if (!checks.minLength) message = `Use at least ${PASSWORD_MIN} characters`;
  else if (!checks.maxLength) message = `Use at most ${PASSWORD_MAX} characters`;
  else if (!checks.hasLower) message = "Add a lowercase letter";
  else if (!checks.hasUpper) message = "Add an uppercase letter";
  else if (!checks.hasDigit) message = "Add a number";
  else if (!checks.hasSymbol) message = "Add a symbol (!@#$%)";
  else if (!checks.notCommon) message = "Choose a less common password";

  let score = 0;
  if (checks.minLength) score += 1;
  if (password.length >= 12) score += 1;
  if (checks.hasLower && checks.hasUpper) score += 1;
  if (checks.hasDigit) score += 1;
  if (checks.hasSymbol) score += 1;
  if (password.length >= 16) score += 1;
  const strength: PasswordStrength = score >= 5 ? "strong" : score >= 3 ? "fair" : "weak";

  return { ok, checks, strength, message };
}

export const PASSWORD_REQUIREMENT_LABELS: {
  key: keyof PasswordChecks;
  label: string;
}[] = [
  { key: "minLength", label: `At least ${PASSWORD_MIN} characters` },
  { key: "hasLower", label: "One lowercase letter" },
  { key: "hasUpper", label: "One uppercase letter" },
  { key: "hasDigit", label: "One number" },
  { key: "hasSymbol", label: "One symbol (!@#$%)" },
  { key: "notCommon", label: "Not a commonly used password" },
];
