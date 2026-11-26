import { APIError } from "better-auth/api";
import { defineAuth } from "void/auth";
import { isAllowedEmail, readAllowedEmails } from "./server/allowed-email";

export default defineAuth(({ defaults, env }) => {
  const readSetting = (key: string) => typeof env[key] === "string" ? env[key].trim() : "";
  const clientId = readSetting("AUTH_GOOGLE_CLIENT_ID");
  const clientSecret = readSetting("AUTH_GOOGLE_CLIENT_SECRET");
  const allowlist = readAllowedEmails(env);

  return {
    ...defaults,
    emailAndPassword: { enabled: false },
    onAPIError: { ...defaults.onAPIError, errorURL: "/login" },
    account: {
      ...defaults.account,
      accountLinking: { enabled: false },
      encryptOAuthTokens: true,
    },
    socialProviders: clientId && clientSecret ? {
      google: {
        clientId,
        clientSecret,
        prompt: "select_account",
        disableIdTokenSignIn: true,
        requireEmailVerification: true,
        overrideUserInfoOnSignIn: true,
        async getAccountFields(_tokens, profile) {
          const verified = profile.emailVerified === true;
          if (verified && isAllowedEmail(profile.email, allowlist)) return;

          const db = env.DB as D1Database;
          await db.prepare("INSERT INTO audit_events (event, reason) VALUES (?, ?)")
            .bind("auth.sign_in_denied", verified ? "not_allowlisted" : "email_unverified")
            .run();

          throw new APIError("FORBIDDEN", {
            code: "ACCOUNT_NOT_ALLOWED",
            message: "This Google account is not allowed.",
          });
        },
      },
    } : {},
  };
});
