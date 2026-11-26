import { defineEnv, string } from "void/env";

export default defineEnv({
  AUTH_GOOGLE_CLIENT_ID: string().optional(),
  AUTH_GOOGLE_CLIENT_SECRET: string().optional(),
  FAVVVVVV_ALLOWED_EMAILS: string().optional(),
  FAVVVVVV_METADATA_MODE: string().optional(),
  FAVPAGE_ALLOWED_EMAILS: string().optional(),
  FAVPAGE_METADATA_MODE: string().optional(),
});
