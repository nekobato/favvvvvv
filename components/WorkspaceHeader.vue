<script setup lang="ts">
import { ref } from "vue";
import { auth } from "void/client";
import ActionIcon from "./ActionIcon.vue";

const props = defineProps<{ email: string; section: "dashboard" | "flow" | "collections" }>();
const signingOut = ref(false);
const signOutFailed = ref(false);

async function signOut() {
  signingOut.value = true;
  signOutFailed.value = false;
  try {
    const { error } = await auth.signOut();
    if (error) signOutFailed.value = true;
    else window.location.assign("/login");
  } catch {
    signOutFailed.value = true;
  } finally {
    signingOut.value = false;
  }
}
</script>

<template>
  <header class="masthead">
    <p class="brand"><span class="brand-mark" aria-hidden="true"></span>favvvvvv</p>
    <nav class="navigation" aria-label="メインナビゲーション">
      <a href="/" :aria-current="props.section === 'dashboard' ? 'page' : undefined">Dashboard</a>
      <a href="/flow" :aria-current="props.section === 'flow' ? 'page' : undefined">フローリスト</a>
      <a href="/collections" :aria-current="props.section === 'collections' ? 'true' : undefined">コレクション</a>
    </nav>
    <div class="account">
      <span class="email" :title="props.email">{{ props.email }}</span>
      <button
        class="button size-icon" type="button" aria-label="ログアウト" title="ログアウト"
        :disabled="signingOut" @click="signOut"
      >
        <ActionIcon name="logout" />
      </button>
    </div>
    <p v-if="signOutFailed" class="error" role="alert">ログアウトに失敗しました。再試行してください。</p>
  </header>
</template>

<style scoped>
.masthead {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 20px;
  inline-size: var(--workspace-width);
  min-block-size: 68px;
  padding-block: 12px;
  margin-inline: auto;
}

.brand {
  flex: none;
}

.navigation, .account {
  display: flex;
  align-items: center;
  gap: 4px;
}

.navigation {
  flex-wrap: wrap;
}

.navigation a {
  display: inline-flex;
  align-items: center;
  min-block-size: 40px;
  padding: 6px 8px;
  color: var(--muted);
  border-radius: 8px;
  font-size: 14px;
  font-weight: 650;
  text-decoration: none;
}

.navigation a:hover, .navigation a[aria-current] {
  color: var(--accent);
  background: var(--accent-soft);
}

.account {
  min-inline-size: 0;
  max-inline-size: 100%;
  margin-inline-start: auto;
}

.email {
  overflow: hidden;
  color: var(--muted);
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.error {
  flex-basis: 100%;
  order: 4;
}

@media (max-width: 680px) {
  .masthead {
    gap: 4px 12px;
  }

  .account {
    max-inline-size: calc(100% - 112px);
  }

  .navigation {
    order: 3;
    inline-size: 100%;
  }

  .navigation a {
    padding-inline: 4px;
  }
}
</style>
