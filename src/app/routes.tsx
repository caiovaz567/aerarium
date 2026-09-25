import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router'
import { CardPage } from '../features/cartao/CardPage'
import { CardsPage } from '../features/cartoes/CardsPage'
import { SettingsPage } from '../features/config/SettingsPage'
import { LoginPage } from '../features/login/LoginPage'
import { ResetPasswordPage } from '../features/login/ResetPasswordPage'
import { MonthsPage } from '../features/meses/MonthsPage'
import { SubscriptionsPage } from '../features/assinaturas/SubscriptionsPage'
import { AppShell } from './AppShell'
import { useAuth } from './authContext'
import { currentMonth, monthPath } from './paths'

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

function ToCurrentMonth() {
  return <Navigate to={monthPath(currentMonth())} replace />
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<ToCurrentMonth />} />
          <Route path="meses" element={<ToCurrentMonth />} />
          <Route path="meses/:ym" element={<MonthsPage />} />
          <Route path="cartoes" element={<CardsPage />} />
          <Route path="cartoes/:id" element={<CardPage />} />
          <Route path="assinaturas" element={<SubscriptionsPage />} />
          <Route path="config" element={<SettingsPage />} />
          <Route path="*" element={<ToCurrentMonth />} />
        </Route>
      </Route>
    </Routes>
  )
}
