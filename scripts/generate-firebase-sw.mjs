#!/usr/bin/env node
// public/firebase-messaging-sw.template.js를 VITE_FIREBASE_* 환경변수로 치환해
// public/firebase-messaging-sw.js를 생성한다(생성 파일은 gitignore 대상).
// Service Worker는 Vite 모듈 그래프 밖이라 import.meta.env를 쓸 수 없어 build 직전에
// 별도로 값을 주입해야 한다 — local(vite build)과 CI/Docker(build-arg) 양쪽 경로가
// 이 스크립트 하나로 동일하게 동작한다. 값 누락 시 잘못된 SW를 조용히 만들지 않고 즉시 실패한다.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const templatePath = resolve(__dirname, '../public/firebase-messaging-sw.template.js')
const outputPath = resolve(__dirname, '../public/firebase-messaging-sw.js')

const REQUIRED_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
]

// process.env에 없으면 .env.production(로컬 전용, gitignore 대상)에서 보조로 읽는다 —
// Docker/CI는 build-arg로 이미 process.env에 값이 있어 이 파일이 없어도 된다.
function loadDotEnvProduction() {
  const envPath = resolve(__dirname, '../.env.production')
  if (!existsSync(envPath)) return {}
  const result = {}
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    result[key] = value
  }
  return result
}

const fileEnv = loadDotEnvProduction()
const values = {}
const missing = []

for (const key of REQUIRED_KEYS) {
  const value = process.env[key] || fileEnv[key]
  if (!value) {
    missing.push(key)
  } else {
    values[key] = value
  }
}

if (missing.length > 0) {
  console.error(
    `[generate-firebase-sw] 다음 환경변수가 없어 firebase-messaging-sw.js를 생성할 수 없습니다: ${missing.join(', ')}\n` +
      '  - 로컬: .env.production에 값을 채우세요 (.env.production.example 참고)\n' +
      '  - CI/Docker: build-arg로 전달되는지 확인하세요 (deploy.yml, Dockerfile)'
  )
  process.exit(1)
}

let content = readFileSync(templatePath, 'utf-8')
for (const key of REQUIRED_KEYS) {
  const placeholder = `__${key}__`
  if (!content.includes(placeholder)) {
    console.error(`[generate-firebase-sw] template에 ${placeholder} 자리표시자가 없습니다.`)
    process.exit(1)
  }
  content = content.split(placeholder).join(JSON.stringify(values[key]))
}

writeFileSync(outputPath, content)
console.log('[generate-firebase-sw] firebase-messaging-sw.js 생성 완료 (설정값은 출력하지 않음)')
