import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import AuthLayout from '@/layouts/AuthLayout'
import DefaultLayout from '@/layouts/DefaultLayout/DefaultLayout'
import MobileLayout from '@/layouts/MobileLayout/MobileLayout'
import LoadingState from '@/shared/components/feedback/LoadingState'
import MobilePlaceholderPage from '../pages/MobilePlaceholderPage'
import NotFoundPage from '../pages/NotFoundPage'
import PlaceholderPage from '../pages/PlaceholderPage'
import GuestRoute from './GuestRoute'
import ProtectedRoute from './ProtectedRoute'
import RoleRoute from './RoleRoute'
import SiteRoute from './SiteRoute'
import { routeConfig } from './routeConfig'

const DesignSystemPage = lazy(() => import('@/dev/DesignSystemPage'))

const LAYOUTS = {
  auth: AuthLayout,
  'mobile-auth': AuthLayout,
  default: DefaultLayout,
  mobile: MobileLayout,
}

// requiredRole 있으면 로그인+권한 가드, guestOnly면 반대로 비로그인 전용 가드로 감싼다
// requiresSite는 권한 통과 후 마지막에 적용 — 권한 미달이면 현장 조회 자체가 불필요
function guard(route, element) {
  if (route.guestOnly) return <GuestRoute>{element}</GuestRoute>
  if (!route.requiredRole) return element
  const guarded = route.requiresSite ? <SiteRoute>{element}</SiteRoute> : element
  return (
    <ProtectedRoute>
      <RoleRoute requiredRole={route.requiredRole} forbiddenMessage={route.forbiddenMessage}>
        {guarded}
      </RoleRoute>
    </ProtectedRoute>
  )
}

// layout별로 라우트 묶기 → <Layout><Outlet/></Layout> 중첩 라우트 구성용
function groupByLayout() {
  const groups = new Map()
  routeConfig.forEach((route) => {
    if (!groups.has(route.layout)) groups.set(route.layout, [])
    groups.get(route.layout).push(route)
  })
  return groups
}

export default function AppRouter() {
  const groups = groupByLayout()

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />

      {Array.from(groups.entries()).map(([layoutKey, routes]) => {
        const Layout = LAYOUTS[layoutKey]
        // 미구현 화면 자리표시자도 모바일/PC는 항상 다른 컴포넌트 — 절대 같은 인스턴스를 공유하지 않는다
        const Fallback = layoutKey === 'mobile' ? MobilePlaceholderPage : PlaceholderPage
        return (
          <Route key={layoutKey} element={<Layout />}>
            {routes.map((route) => {
              const Page = route.page
              const element = Page ? <Page /> : <Fallback title={route.title} scrId={route.scrId} />
              return <Route key={route.path} path={route.path} element={guard(route, element)} />
            })}
          </Route>
        )
      })}

      <Route
        path="/design-system"
        element={
          <Suspense fallback={<LoadingState />}>
            <DesignSystemPage />
          </Suspense>
        }
      />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
