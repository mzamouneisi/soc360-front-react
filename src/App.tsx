import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { AdminRoute } from './auth/AdminRoute'
import { PublicOnlyRoute } from './auth/PublicOnlyRoute'
import { PasswordGuard } from './auth/PasswordGuard'
import { NotConsultantRoute } from './auth/NotConsultantRoute'
import { MainLayout } from './layout/MainLayout'
import { Dashboard } from './pages/Dashboard'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { VerifyEmail } from './pages/VerifyEmail'
import { ForgotPassword } from './pages/ForgotPassword'
import { ResetPassword } from './pages/ResetPassword'
import { ChangePassword } from './pages/ChangePassword'
import { Clients } from './pages/Clients'
import { Suppliers } from './pages/Suppliers'
import { Projects } from './pages/Projects'
import { Missions } from './pages/Missions'
import { Consultants } from './pages/Consultants'
import { Activities } from './pages/Activities'
import { ActivityTypes } from './pages/ActivityTypes'
import { CraList } from './pages/CraList'
import { CraDetailRoute } from './pages/CraDetail'
import { IndispoList } from './pages/IndispoList'
import { NoteFraisList } from './pages/NoteFraisList'
import { Holidays } from './pages/Holidays'
import { Facturation } from './pages/Facturation'
import { FichePaie } from './pages/FichePaie'
import { Documents } from './pages/Documents'
import { Messages } from './pages/Messages'
import { Support } from './pages/Support'
import { Profile } from './pages/Profile'
import { Settings } from './pages/Settings'
import { Users } from './pages/Users'
import { SocAdmin } from './pages/SocAdmin'
import { DemoSoc } from './pages/DemoSoc'
import { Tables } from './pages/Tables'
import { Logs } from './pages/Logs'
import { NotFound } from './pages/NotFound'

const router = createBrowserRouter(
  [
    {
      element: <PublicOnlyRoute />,
      children: [
        { path: '/login', element: <Login /> },
        { path: '/inscription', element: <Register /> },
        { path: '/auth/verify-email', element: <VerifyEmail /> },
        { path: '/forgot-password', element: <ForgotPassword /> },
        { path: '/reset-password/:token', element: <ResetPassword /> },
      ],
    },
    {
      element: <ProtectedRoute />,
      children: [
        {
          element: (
            <PasswordGuard>
              <MainLayout />
            </PasswordGuard>
          ),
          children: [
            { path: '/', element: <Dashboard /> },
            {
              path: '/clients',
              element: (
                <NotConsultantRoute>
                  <Clients />
                </NotConsultantRoute>
              ),
            },
            {
              path: '/fournisseurs',
              element: (
                <NotConsultantRoute>
                  <Suppliers />
                </NotConsultantRoute>
              ),
            },
            {
              path: '/projets',
              element: (
                <NotConsultantRoute>
                  <Projects />
                </NotConsultantRoute>
              ),
            },
            {
              path: '/missions',
              element: (
                <NotConsultantRoute>
                  <Missions />
                </NotConsultantRoute>
              ),
            },
            {
              path: '/consultants',
              element: (
                <NotConsultantRoute>
                  <Consultants />
                </NotConsultantRoute>
              ),
            },
            {
              path: '/activites',
              element: (
                <NotConsultantRoute>
                  <Activities />
                </NotConsultantRoute>
              ),
            },
            {
              path: '/types-activites',
              element: (
                <NotConsultantRoute>
                  <ActivityTypes />
                </NotConsultantRoute>
              ),
            },
            { path: '/cras', element: <CraList /> },
            { path: '/cras/:id', element: <CraDetailRoute /> },
            { path: '/indispos', element: <IndispoList /> },
            { path: '/indispos/:id', element: <CraDetailRoute /> },
            { path: '/notes-frais', element: <NoteFraisList /> },
            { path: '/jours-feries', element: <Holidays /> },
            {
              path: '/facturation',
              element: (
                <NotConsultantRoute>
                  <Facturation />
                </NotConsultantRoute>
              ),
            },
            { path: '/fiches-paie', element: <FichePaie /> },
            { path: '/documents', element: <Documents /> },
            { path: '/messages', element: <Messages /> },
            { path: '/support', element: <Support /> },
            { path: '/profil', element: <Profile /> },
            { path: '/parametres', element: <Settings /> },
            { path: '/change-password', element: <ChangePassword /> },
            { path: '/utilisateurs', element: <Users /> },
            { path: '/soc', element: <SocAdmin scope="mine" /> },
            { path: '/soc/toutes', element: <SocAdmin scope="all" /> },
            {
              path: '/soc/demo',
              element: (
                <AdminRoute>
                  <DemoSoc />
                </AdminRoute>
              ),
            },
            {
              path: '/tables',
              element: (
                <AdminRoute>
                  <Tables />
                </AdminRoute>
              ),
            },
            {
              path: '/logs',
              element: (
                <AdminRoute>
                  <Logs />
                </AdminRoute>
              ),
            },
          ],
        },
      ],
    },
    { path: '*', element: <NotFound /> },
  ],
  { basename: import.meta.env.BASE_URL },
)

export default function App() {
  return <RouterProvider router={router} />
}
