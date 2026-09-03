// FCM 백그라운드 푸시 수신용 서비스워커 template. public/ 아래 정적 파일이라 Vite가 번들링하지
// 않고(import 문법을 못 씀) import.meta.env도 쓸 수 없어(Service Worker는 모듈 그래프 밖),
// scripts/generate-firebase-sw.mjs가 build 직전에 VITE_FIREBASE_* 환경변수로 아래
// __PLACEHOLDER__들을 치환해 public/firebase-messaging-sw.js를 생성한다.
// 생성된 파일은 gitignore 대상이고, 이 template만 git에 추적한다 — 실제 프로젝트 설정값을
// 이 파일에 직접 적지 않는다.
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: __VITE_FIREBASE_API_KEY__,
  authDomain: __VITE_FIREBASE_AUTH_DOMAIN__,
  projectId: __VITE_FIREBASE_PROJECT_ID__,
  storageBucket: __VITE_FIREBASE_STORAGE_BUCKET__,
  messagingSenderId: __VITE_FIREBASE_MESSAGING_SENDER_ID__,
  appId: __VITE_FIREBASE_APP_ID__,
})

const messaging = firebase.messaging()

// 앱이 백그라운드(탭 비활성/닫힘)일 때 수신되는 알림 — 포그라운드는 onMessage로 별도 처리 필요(다음 단계)
// Backend(FcmPushService)는 title/body를 notification이 아니라 data 필드로 보낸다(alertId/panelId 등과
// 함께 data-only 메시지) - data를 우선 읽고, notification 필드로 오는 경우도 대비해 fallback으로 둔다.
messaging.onBackgroundMessage((payload) => {
  const title = payload.data?.title ?? payload.notification?.title ?? 'ArcGuard'
  const body = payload.data?.body ?? payload.notification?.body ?? '새로운 경보가 발생했습니다.'
  self.registration.showNotification(title, {
    body,
    icon: '/ArcGuard.png',
  })
})
