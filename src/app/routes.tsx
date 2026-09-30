import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router'
import { CardRedirect, CardsPage } from '../features/cartoes/CardsPage'
import { SharedPage } from '../features/compartilhado/SharedPage'
import { SettingsPage } from '../features/config/SettingsPage'
import { LoginPage } from '../features/login/LoginPage'
import { ResetPasswordPage } from '../features/login/ResetPasswordPage'
import { MonthsIndex, MonthsPage } from '../features/meses/MonthsPage'
import { SubscriptionsPage } from '../features/assinaturas/SubscriptionsPage'
import { PrivacyPage } from '../features/privacidade/PrivacyPage'
import { AppShell } from './AppShell'
import { useAuth } from './authContext'

function RequireAuth() {
  const auth = useAuth()
  const location = useLocation()
  if (auth.status === 'loading')
    return <div className="splash" aria-busy="true" aria-label="Carregando" />
  if (auth.status === 'signed-out')
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    )
  return <Outlet />
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
      <Route path="/privacidade" element={<PrivacyPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<MonthsIndex />} />
          <Route path="meses" element={<MonthsIndex />} />
          <Route path="meses/:ym" element={<MonthsPage />} />
          <Route path="cartoes" element={<CardsPage />} />
          <Route path="cartoes/:id" element={<CardRedirect />} />
          <Route path="assinaturas" element={<SubscriptionsPage />} />
          <Route path="config" element={<SettingsPage />} />
          <Route path="compartilhado" element={<SharedPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  )
}
