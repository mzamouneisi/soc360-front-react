import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import type { Role } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { ROLE_LABELS, initials } from '../lib/format'
import { SocSelector } from '../soc/SocSelector'
import { NotificationBell } from './NotificationBell'
import { GlobalLoading } from '../components/GlobalLoading'

interface NavItem {
  to: string
  label: string
  icon: string
  end?: boolean
}

interface NavSection {
  title?: string
  items: NavItem[]
}

const HIDDEN_FOR_CONSULTANT = new Set([
  '/clients',
  '/fournisseurs',
  '/projets',
  '/missions',
  '/consultants',
  '/activites',
  '/types-activites',
  '/facturation',
])

const ICONS = {
  dashboard: 'M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z',
  clients: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4Zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4Z',
  suppliers: 'M2 15h2v2h2v-2h4v2h2v-2h4v2h2v-2h2a2 2 0 0 0 2-2v-2l-1-5h-4V5h-2v3H5L3 9v6h-1v2Zm18-6h-2l.5 3H20v-3Z',
  projects: 'M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2Z',
  missions: 'M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Zm-5 14H7v-2h7v2Zm3-4H7v-2h10v2Zm0-4H7V7h10v2Z',
  consultants: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3Zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3Zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5Zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5Z',
  activities: 'M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14A9 9 0 1 0 13 3Zm0 8h5a5 5 0 0 1-5 5V11Z',
  cra: 'M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Zm-2 12h-2V7h-2v8h-2V7h-2v8h-2V7H9v8H7v-2H5v4h14v-2Z',
  expenses: 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm3.5 8h-7v-2h7Zm-2 6h-3v-2h3Z',
  holiday: 'M19 3h-1V1h-2v2H8V1H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Zm0 16H5V8h14v11ZM7 10h5v5H7v-5Z',
  billing: 'M20 8h-3V4H3a2 2 0 0 0-2 2v11h2a2 2 0 1 0 4 0h6a2 2 0 1 0 4 0h4V8l-1-4H5v2h15v10h-4V8Z',
  payslips: 'M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Zm-7 14H7v-2h5v2Zm5-4H7v-2h10v2Zm0-4H7V7h10v2Z',
  documents: 'M6 2a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6H6Zm7 7V3.5L18.5 9H13Zm-1 10c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3Z',
  messages: 'M20 2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14l4 4V4a2 2 0 0 0-2-2Zm-2 12H6v-2h12v2Zm0-3H6V9h12v2Zm0-3H6V6h12v2Z',
  support: 'M11 18h2v-2h-2v2Zm1-16A10 10 0 0 0 2 12a10 10 0 0 0 10 10 10 10 0 0 0 10-10A10 10 0 0 0 12 2Zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8Zm0-14a4 4 0 0 0-4 4h2a2 2 0 1 1 4 0c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5a4 4 0 0 0-4-4Z',
  users: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4Zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4Z',
  soc: 'M11 7h2v2h-2V7Zm0 4h2v6h-2v-6Zm1-9a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8Z',
  tables: 'M2 20h20v-4H2v4Zm2-3h2v2H4v-2Zm-2-4h20v-4H2v4Zm4-3H4v-2h2v2Zm-4-4h20V4H2v4Z',
  logs: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm0 2v12h16V6H4Zm3 3 3 3-3 3 1.5 1.5L12 12 8.5 7.5 7 9Zm6 6h4v2h-4v-2Z',
  profile: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4Zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4Z',
}

function NavSection({ section, role }: { section: NavSection; role: Role }) {
  const items =
    role === 'CONSULTANT' ? section.items.filter((item) => !HIDDEN_FOR_CONSULTANT.has(item.to)) : section.items
  if (items.length === 0) return null

  return (
    <div>
      {section.title && (
        <p className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
          {section.title}
        </p>
      )}
      <div className="space-y-0.5">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end ?? item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                isActive
                  ? 'bg-brand-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d={item.icon} />
            </svg>
            {item.label}
          </NavLink>
        ))}
      </div>
    </div>
  )
}

function HorlogeNumerique() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const date = now.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })
  const time = now.toLocaleTimeString('fr-FR', { hour12: false })

  return (
    <div className="text-left">
      <div className="font-mono text-lg font-semibold tracking-wider text-horloge">
        {time}
      </div>
      <div className="text-lg text-gray-400">{date}</div>
    </div>
  )
}

export function MainLayout() {
  const { user, logout } = useAuth()
  if (!user) return null

  const isAdmin = user.role === 'ADMIN'
  const _LAST_COMMIT_ = '2026_09_11_11_55_15'

  const sections: NavSection[] = [
    {
      items: [
        { to: '/', label: 'Tableau de bord', icon: ICONS.dashboard },
      ],
    },
    {
      title: 'Gestion',
      items: [
        { to: '/clients', label: 'Clients', icon: ICONS.clients },
        { to: '/fournisseurs', label: 'Fournisseurs', icon: ICONS.suppliers },
        { to: '/projets', label: 'Projets', icon: ICONS.projects },
        { to: '/types-activites', label: 'Types d’activités', icon: ICONS.activities },
        { to: '/activites', label: 'Activités & tarifs', icon: ICONS.activities },
        { to: '/consultants', label: 'Collaborateurs', icon: ICONS.consultants },
        { to: '/missions', label: 'Missions', icon: ICONS.missions },
      ],
    },
    {
      title: 'Activité',
      items: [
        { to: '/cras', label: 'CRA', icon: ICONS.cra },
        { to: '/indispos', label: 'Indispos', icon: ICONS.holiday },
        { to: '/notes-frais', label: 'Notes de frais', icon: ICONS.expenses },
        { to: '/jours-feries', label: 'Jours fériés', icon: ICONS.holiday },
      ],
    },
    {
      title: 'Finance',
      items: [
        { to: '/facturation', label: 'Facturation', icon: ICONS.billing },
        { to: '/fiches-paie', label: 'Fiches de paie', icon: ICONS.payslips },
      ],
    },
    {
      title: 'Espace',
      items: [
        { to: '/documents', label: 'Documents', icon: ICONS.documents },
        { to: '/messages', label: 'Messages', icon: ICONS.messages },
        { to: '/support', label: 'Support', icon: ICONS.support },
        { to: '/parametres', label: 'Paramètres', icon: ICONS.support },
      ],
    },
  ]

  if (user.role === 'ADMIN' || user.role === 'RESPONSIBLE_SOC') {
    const socItems: NavItem[] = []
    if (isAdmin) {
      socItems.push({ to: '/soc/demo', label: 'Société démo', icon: ICONS.soc })
    }
    socItems.push({ to: '/soc', label: 'Mes sociétés', icon: ICONS.soc, end: true })
    socItems.push({ to: '/soc/toutes', label: 'Toutes les sociétés', icon: ICONS.soc })
    sections.splice(1, 0, { title: 'Sociétés', items: socItems })
  }

  if (isAdmin) {
    sections.push({
      title: 'Administration',
      items: [
        { to: '/tables', label: 'Base de données', icon: ICONS.tables },
        { to: '/logs', label: 'Logs du serveur', icon: ICONS.logs },
      ],
    })
  }

  return (
    <div className="flex h-full">
      <aside className="flex w-64 shrink-0 flex-col overflow-y-auto bg-gray-900 text-gray-300">
        <div className="flex h-16 shrink-0 items-center gap-2 px-5 text-lg font-bold text-white">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-extrabold">
            E
          </span>
          SOC360
        </div>

        <div id="_horloge_numerique" className="px-5 pb-3">
          <HorlogeNumerique />
        </div>

        <p className="px-5 pb-2 text-gray-500 font_last_commit">
          Last Commit : <br></br>{_LAST_COMMIT_}
        </p>

        <nav className="flex-1 space-y-0.5 px-3 pb-4">
          {sections.map((section, i) => (
            <NavSection key={i} section={section} role={user.role} />
          ))}
        </nav>

        <div className="border-t border-gray-800 p-3">
          <NavLink
            to="/profil"
            className="flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-sm font-medium text-gray-300 transition hover:bg-gray-800 hover:text-white"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d={ICONS.profile} />
            </svg>
            Profil
          </NavLink>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6">
          <div>
            {isAdmin ? (
              <NavLink
                to="/"
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-brand-700"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d={ICONS.dashboard} />
                </svg>
                Dashboard
              </NavLink>
            ) : (
              <SocSelector />
            )}
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <NavLink
              to="/profil"
              title="Voir mon profil"
              className="flex items-center gap-2 rounded-full border border-gray-200 bg-white py-1 pl-1 pr-3 shadow-sm transition hover:border-brand-600 hover:shadow"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                {initials(user.firstName, user.lastName)}
              </div>
              <div className="leading-tight">
                <p className="text-sm font-semibold text-gray-900">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-xs text-gray-500">{ROLE_LABELS[user.role]}</p>
              </div>
            </NavLink>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-red-50 hover:text-red-600"
              title="Se déconnecter"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5ZM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5Z" />
              </svg>
              Quitter
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
      <GlobalLoading />
    </div>
  )
}
