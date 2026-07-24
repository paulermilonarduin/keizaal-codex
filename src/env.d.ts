declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent
  export default component
}

// Injecté par vite.config.ts depuis package.json (#42).
declare const __APP_VERSION__: string
