import { getUser } from "void/auth";
import { isAllowedEmail, readAllowedEmails, type AllowedEmailEnv } from "./allowed-email";

export function getAllowedUser(env: AllowedEmailEnv) {
  const user = getUser();
  return user?.emailVerified && isAllowedEmail(user.email, readAllowedEmails(env)) ? user : null;
}
