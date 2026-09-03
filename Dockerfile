# firesafety-fe-react 프론트엔드 이미지. Vite 빌드 후 nginx로 정적 파일만 서빙하는 멀티스테이지 빌드.
# firesafety-fe(Vue) 레포의 Dockerfile과 동일한 구조 — 회사 물리서버(x86_64)에 그대로 빌드해서 쓴다.
# 개발 Mac(Apple Silicon)에서 이미지를 만들어 옮길 때만
# `docker buildx build --platform linux/amd64 ...`로 빌드할 것.

# 1단계: Vite 빌드
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vite는 VITE_* 값을 런타임이 아니라 빌드 시점에 번들에 굽는다. 로컬 .env.production은
# gitignore 대상이라 CI 러너에는 존재하지 않으므로, GitHub Actions에서 build-args로 전달받은
# 값을 ENV로 노출해 `vite build`가 process.env에서 읽도록 한다(Vite는 접두사가 VITE_인
# process.env 값을 .env 파일 없이도 자동으로 import.meta.env에 반영한다).
# 전부 Firebase 클라이언트 웹 설정(공개 식별자) - 서버 secret이 아니다.
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_STORAGE_BUCKET
ARG VITE_FIREBASE_MESSAGING_SENDER_ID
ARG VITE_FIREBASE_APP_ID
ARG VITE_FIREBASE_VAPID_KEY
ENV VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY \
    VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN \
    VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID \
    VITE_FIREBASE_STORAGE_BUCKET=$VITE_FIREBASE_STORAGE_BUCKET \
    VITE_FIREBASE_MESSAGING_SENDER_ID=$VITE_FIREBASE_MESSAGING_SENDER_ID \
    VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID \
    VITE_FIREBASE_VAPID_KEY=$VITE_FIREBASE_VAPID_KEY

RUN npm run build

# 2단계: 정적 파일 서빙
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
