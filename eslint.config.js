import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // template은 실행되는 JS가 아니라 generate-firebase-sw.mjs가 문자열 치환할 텍스트라 lint 대상 아님
  globalIgnores(['dist', 'public/firebase-messaging-sw.template.js']),
  {
    files: ['**/*.{js,jsx}'],
    ignores: ['vite.config.js'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  {
    // vite.config.js는 브라우저가 아니라 Node(Vite CLI)에서 실행됨 → process 등 Node 전역 필요
    files: ['vite.config.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    // Vite 번들 대상이 아니라 브라우저가 Service Worker로 직접 로드하는 raw 파일 →
    // importScripts로 불러온 firebase-app/messaging-compat이 전역에 firebase를 붙인다
    files: ['public/firebase-messaging-sw.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: { ...globals.serviceworker, firebase: 'readonly' },
    },
  },
])
