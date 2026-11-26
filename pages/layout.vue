<template>
  <slot />
</template>

<style>
:root {
  color-scheme: light;
  --canvas: oklch(0.975 0.01 170);
  --paper: oklch(0.998 0.002 170);
  --ink: oklch(0.255 0.024 168);
  --muted: oklch(0.46 0.027 167);
  --control-surface: oklch(0.935 0.021 170);
  --control-line: oklch(0.62 0.035 170);
  --accent: oklch(0.44 0.092 165);
  --accent-hover: oklch(0.37 0.081 165);
  --accent-soft: oklch(0.935 0.034 164);
  --on-accent: oklch(0.995 0.005 164);
  --danger: oklch(0.43 0.154 25);
  --danger-soft: oklch(0.955 0.026 25);
  --workspace-width: min(calc(100% - clamp(32px, 8vw, 80px)), 960px);

  background: var(--canvas);
  color: var(--ink);
  font: 16px/1.55 system-ui, "Hiragino Sans", "Yu Gothic", sans-serif;
}

*, *::before, *::after {
  box-sizing: border-box;
}

body, h1, h2, p {
  margin: 0;
}

input, button {
  font: inherit;
}

a {
  color: var(--accent);
}

.workspace {
  inline-size: var(--workspace-width);
  padding-block: clamp(32px, 6vw, 64px) 64px;
  margin-inline: auto;
}

.workspace h1 {
  overflow-wrap: anywhere;
  font-size: clamp(24px, 5vw, 40px);
  line-height: 1.2;
  letter-spacing: -0.03em;
}

.capture-form {
  display: flex;
  align-items: center;
  gap: 8px;
  max-inline-size: 600px;
  margin-block-end: 8px;
}

.capture-form .input {
  background: var(--control-surface);
  border: 0;
}

.workspace-message {
  margin-block: 16px;
  color: var(--muted);
  font-size: 14px;
}

:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 20px;
  font-weight: 750;
  letter-spacing: -0.04em;
}

.brand-mark {
  inline-size: 12px;
  block-size: 16px;
  background: var(--accent);
  border-radius: 2px 2px 0 0;
  clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 74%, 0 100%);
}

.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-block-size: 40px;
  padding: 8px 16px;
  color: var(--ink);
  background: var(--control-surface);
  border: 0;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 650;
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
}

.button:hover:not(:disabled) {
  background: var(--accent-soft);
}

.button:disabled {
  opacity: 0.52;
  cursor: default;
}

.button.size-icon {
  flex: none;
  inline-size: 40px;
  block-size: 40px;
  padding: 0;
  color: var(--muted);
  background: transparent;
}

.button.size-icon:hover:not(:disabled) {
  color: var(--accent);
  background: var(--accent-soft);
}

.button.size-icon.is-destructive:hover:not(:disabled) {
  color: var(--danger);
  background: var(--danger-soft);
}

.button.type-primary {
  color: var(--on-accent);
  background: var(--accent);
}

.button.type-primary:hover:not(:disabled) {
  background: var(--accent-hover);
}

.button.type-danger {
  color: var(--on-accent);
  background: var(--danger);
}

.button.type-danger:hover:not(:disabled) {
  background: var(--ink);
}

.input {
  inline-size: 100%;
  min-inline-size: 0;
  min-block-size: 44px;
  padding: 8px 12px;
  color: var(--ink);
  background: var(--paper);
  border: 1px solid var(--control-line);
  border-radius: 8px;
}

.input::placeholder {
  color: var(--muted);
}

.input[aria-invalid="true"] {
  border-color: var(--danger);
}

.error {
  color: var(--danger);
  font-size: 14px;
  overflow-wrap: anywhere;
}

.dialog {
  inline-size: min(480px, calc(100% - 32px));
  max-block-size: calc(100% - 32px);
  padding: 24px;
  overscroll-behavior: contain;
  color: var(--ink);
  background: var(--paper);
  border: 0;
  border-radius: 12px;
}

.dialog::backdrop {
  background: oklch(0.24 0.025 168 / 0.42);
}

.dialog h2 {
  font-size: 20px;
}

.dialog-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  margin-block-start: 16px;
}

.sr-only {
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>
