<script setup lang="ts">
import { ref } from "vue";
import { auth } from "void/client";
import { readShareFragment, shareFlowPath, shareFragment, shareLoginPath } from "../shared/share";
import type { Props } from "./login.server";

const { configured, signInFailed } = defineProps<Props>();
const pending = ref(false);
const requestFailed = ref(false);

async function signIn() {
  pending.value = true;
  requestFailed.value = false;
  const sharedUrl = readShareFragment(window.location.hash);
  const draft = sharedUrl === null ? "" : shareFragment(sharedUrl);
  try {
    const { error } = await auth.signIn.social({
      provider: "google",
      callbackURL: draft ? shareFlowPath + draft : "/",
      errorCallbackURL: draft ? shareLoginPath + draft : "/login",
    });
    requestFailed.value = !!error;
  } catch {
    requestFailed.value = true;
  } finally {
    pending.value = false;
  }
}
</script>

<template>
  <main class="login">
    <section class="card" aria-labelledby="login-title">
      <p class="brand"><span class="brand-mark" aria-hidden="true"></span>favvvvvv</p>
      <h1 id="login-title">ログイン</h1>
      <p class="description">設置者が許可した Google アカウントで利用できます。</p>
      <p v-if="signInFailed || requestFailed" class="error" role="alert">
        ログインできませんでした。許可済みの Google アカウントで再試行してください。
      </p>
      <button class="button type-primary" type="button" :disabled="!configured || pending" @click="signIn">
        {{ pending ? "接続中…" : "Google でログイン" }}
      </button>
      <p v-if="!configured" class="description">Google ログインの設定について、設置者に確認してください。</p>
    </section>
  </main>
</template>

<style scoped>
.login {
  display: grid;
  min-block-size: 100svh;
  align-items: center;
  justify-items: center;
  padding: 24px;
}

.card {
  inline-size: min(100%, 440px);
  padding: clamp(24px, 6vw, 40px);
  background: var(--paper);
  border-radius: 16px;
}

h1 {
  margin-block: 24px 8px;
  font-size: 32px;
  line-height: 1.25;
}

.description {
  color: var(--muted);
  font-size: 14px;
}

.error {
  margin-block-start: 16px;
}

.button {
  inline-size: 100%;
  min-block-size: 48px;
  margin-block: 24px 0;
}

.button + .description {
  margin-block-start: 12px;
}
</style>
