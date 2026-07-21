<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue'

const props = defineProps<{
  label: string
  options: { value: string; label: string }[]
  modelValue: string | null
}>()
const emit = defineEmits<{ 'update:modelValue': [string | null] }>()

const isOpen = ref(false)
const root = useTemplateRef<HTMLElement>('root')

const displayValue = computed(
  () => props.options.find((option) => option.value === props.modelValue)?.label ?? props.label,
)

function select(value: string | null): void {
  emit('update:modelValue', value)
  isOpen.value = false
}

function onDocumentClick(event: MouseEvent): void {
  if (root.value !== null && !root.value.contains(event.target as Node)) isOpen.value = false
}

onMounted(() => document.addEventListener('click', onDocumentClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocumentClick))
</script>

<template>
  <div ref="root" class="select" :class="{ 'is-open': isOpen }">
    <button
      type="button"
      class="select__trigger"
      aria-haspopup="listbox"
      @click="isOpen = !isOpen"
    >
      <span class="select__value">{{ displayValue }}</span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>
    <ul class="select__menu" role="listbox">
      <li
        class="select__option"
        :class="{ 'is-selected': modelValue === null }"
        role="option"
        @click="select(null)"
      >
        {{ label }}
      </li>
      <li
        v-for="option in options"
        :key="option.value"
        class="select__option"
        :class="{ 'is-selected': modelValue === option.value }"
        role="option"
        @click="select(option.value)"
      >
        {{ option.label }}
      </li>
    </ul>
  </div>
</template>

<style scoped>
.select {
  position: relative;
  flex: 1 1 auto;
  min-width: 88px;
}
.select__trigger {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 6px 8px;
  font-size: 0.78rem;
  color: var(--text);
  cursor: pointer;
  transition: border-color 0.15s ease;
}
.select__trigger svg {
  flex: none;
  width: 12px;
  height: 12px;
  color: var(--text-muted);
  transition: transform 0.15s ease;
}
.select__trigger:hover {
  border-color: var(--border-strong);
}
.select.is-open .select__trigger {
  border-color: var(--accent);
}
.select.is-open .select__trigger svg {
  transform: rotate(180deg);
}

.select__menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 10;
  background: var(--panel);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.45);
  padding: 4px;
  max-height: 220px;
  overflow-y: auto;
  display: none;
}
.select.is-open .select__menu {
  display: block;
}
.select__option {
  padding: 6px 9px;
  border-radius: 4px;
  font-size: 0.8rem;
  color: var(--text);
  cursor: pointer;
  white-space: nowrap;
}
.select__option.is-selected {
  color: var(--accent);
}
.select__option:hover {
  background: var(--accent);
  color: #14161b;
}
</style>
