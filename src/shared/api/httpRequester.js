import axios from 'axios'
import { clearUser } from '@/features/auth/authSession'
import { extractErrorMessage, isNetworkError, parseBlobErrorBody } from './apiError'
import { showAlert } from './uiAlertBus'

// 인증은 HttpOnly 쿠키(at, rt)로만 처리 — JS는 토큰 직접 안 만짐
// baseURL '/api': dev는 vite proxy, prod는 nginx가 같은 오리진으로 라우팅
const httpRequester = axios.create({
  baseURL: '/api',
  withCredentials: true,
})

// 로그아웃 중 401은 무시하기 위한 플래그
let loggingOut = false
export function setLoggingOut(value) {
  loggingOut = value
}

// 동시 401 발생 시 reissue 중복 호출 방지용 큐
let isRefreshing = false
let pendingQueue = []

// 큐 대기 요청 일괄 처리 (error 있으면 전부 reject, 없으면 전부 resolve)
function resolvePendingQueue(error) {
  pendingQueue.forEach(({ resolve, reject }) => (error ? reject(error) : resolve()))
  pendingQueue = []
}

// 재발급 실패 시 세션 완전 리셋 필요 → SPA 이동 아닌 풀리로드
function redirectToLogin() {
  const isMobile = window.location.pathname.startsWith('/m')
  window.location.href = `${isMobile ? '/m/login' : '/login'}?expired=1`
}

httpRequester.interceptors.response.use(
  (response) => response,
  async (error) => {
    // 서버 도달 자체 실패 (네트워크 끊김 등)
    if (isNetworkError(error)) {
      showAlert('네트워크 오류가 발생했습니다.')
      return Promise.reject(error)
    }

    const { config, response } = error
    const { status } = response
    let { data } = response

    // blob 응답(엑셀 export 등)은 에러 body도 Blob → JSON 재파싱 필요
    if (config.responseType === 'blob' && data instanceof Blob) {
      data = await parseBlobErrorBody(data)
    }

    // 로그아웃 중 401 → 무시
    if (loggingOut && status === 401) {
      return Promise.reject(error)
    }

    // reissue 자체 401 → rt도 만료, 대기 큐 정리 후 로그인 이동
    if (config.url === '/auth/reissue' && status === 401) {
      resolvePendingQueue(error)
      isRefreshing = false
      clearUser()
      redirectToLogin()
      return Promise.reject(error)
    }

    // 로그인 요청 자체 401 → 단순 자격 실패, 재발급 대상 아님
    if (config.url === '/auth/login' && status === 401) {
      showAlert(data?.resultMessage ?? '로그인에 실패했습니다.')
      return Promise.reject(error)
    }

    if (status === 401) {
      if (!isRefreshing) {
        // 첫 401 → 직접 재발급 수행
        isRefreshing = true
        try {
          await httpRequester.post('/auth/reissue')
          isRefreshing = false
          resolvePendingQueue(null) // 대기 요청들 재시도 트리거
        } catch (reissueError) {
          isRefreshing = false
          return Promise.reject(reissueError)
        }
        return httpRequester.request(config) // 원요청 재시도
      }

      // 재발급 진행 중 → 큐 대기
      return new Promise((resolve, reject) => {
        pendingQueue.push({
          resolve: () => resolve(httpRequester.request(config)),
          reject,
        })
      })
    }

    // 호출부가 자체적으로 실패를 처리하겠다고 명시한 요청(예: AI 설명 생성 - 실패해도 이미 표시된
    // 다른 결과에 영향을 주면 안 되는 보조 기능)은 전역 알림을 띄우지 않는다.
    if (config?.suppressGlobalAlert) {
      return Promise.reject(error)
    }

    // 그 외 실패 → 서버 메시지 전역 알림
    showAlert(extractErrorMessage(error))
    return Promise.reject(error)
  },
)

export default httpRequester
