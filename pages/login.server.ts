import { defineHandler, defineHead, type InferProps } from "void";
import { getAllowedUser } from "../server/access";
import { readAllowedEmails } from "../server/allowed-email";
import { shareFlowPath } from "../shared/share";

export const head = defineHead(() => ({ title: "ログイン" }));

export const loader = defineHandler((c) => {
  if (getAllowedUser(c.env)) {
    return c.redirect(c.req.query("share") === "1" ? shareFlowPath : "/");
  }

  return {
    configured: !!(
      readAllowedEmails(c.env)
      && c.env.AUTH_GOOGLE_CLIENT_ID?.trim()
      && c.env.AUTH_GOOGLE_CLIENT_SECRET?.trim()
    ),
    signInFailed: c.req.query("error") !== undefined,
  };
});

export type Props = InferProps<typeof loader>;
