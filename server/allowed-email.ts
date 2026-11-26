export type AllowedEmailEnv = {
  FAVVVVVV_ALLOWED_EMAILS?: unknown;
  FAVPAGE_ALLOWED_EMAILS?: unknown;
};

export function readAllowedEmails(env: AllowedEmailEnv): string {
  const allowlist = env.FAVVVVVV_ALLOWED_EMAILS ?? env.FAVPAGE_ALLOWED_EMAILS;
  return typeof allowlist === "string" ? allowlist.trim() : "";
}

export function isAllowedEmail(email: string | null | undefined, allowlist = ""): boolean {
  const normalized = email?.trim().toLowerCase();
  return !!normalized && allowlist.split(",").some((entry) => entry.trim().toLowerCase() === normalized);
}
