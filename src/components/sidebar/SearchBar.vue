<script setup lang="ts">
defineProps<{ modelValue: string }>()
defineEmits<{ 'update:modelValue': [string] }>()
</script>

<template>
  <div class="search">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
    <input
      type="text"
      placeholder="Rechercher un nom, un #ID, un rôle…"
      :value="modelValue"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
  </div>
</template>

<style scoped>
.search {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 8px 10px;
}
.search svg {
  flex: none;
  color: var(--text-muted);
  width: 15px;
  height: 15px;
}
.search input {
  border: none;
  background: transparent;
  color: var(--text);
  font-size: 0.86rem;
  width: 100%;
  outline: none;
}
.search input::placeholder {
  color: var(--text-muted);
}
</style>
