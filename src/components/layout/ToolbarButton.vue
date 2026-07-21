<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string
    variant?: 'default' | 'primary' | 'ghost' | 'danger'
  }>(),
  { variant: 'default' },
)

defineEmits<{ click: [MouseEvent] }>()
</script>

<template>
  <button
    type="button"
    class="btn btn-icon"
    :class="variant !== 'default' ? `btn-${variant}` : null"
    :aria-label="label"
    :title="label"
    @click="$emit('click', $event)"
  >
    <slot />
  </button>
</template>

<style scoped>
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--bg);
  color: var(--accent);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 7px;
  width: 30px;
  height: 30px;
  cursor: pointer;
  transition:
    background 0.16s ease,
    border-color 0.16s ease,
    transform 0.12s ease;
}
.btn:hover {
  background: color-mix(in srgb, var(--bg) 80%, var(--text) 20%);
  border-color: var(--border-strong);
}
.btn:active {
  transform: translateY(1px);
}
.btn :deep(svg) {
  flex: none;
  width: 15px;
  height: 15px;
}
.btn-primary {
  border-color: var(--accent-dim);
}
.btn-primary:hover {
  border-color: var(--accent);
}
.btn-ghost {
  background: transparent;
  border-color: transparent;
}
.btn-ghost:hover {
  background: color-mix(in srgb, var(--bg) 80%, var(--text) 20%);
}
.btn-danger {
  color: var(--rel-ennemi);
  border-color: color-mix(in srgb, var(--rel-ennemi) 40%, var(--bg) 60%);
}
.btn-danger:hover {
  background: color-mix(in srgb, var(--rel-ennemi) 18%, var(--bg) 82%);
}
</style>
