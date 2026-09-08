import { useAuth } from '../auth/AuthContext'
import { useSoc } from '../soc/SocContext'
import { Card, RefreshButton } from '../components/ui'
import { Badge, LoadingBlock, ErrorBlock } from '../components/data'
import { dashboardApi } from '../api/dashboard'
import { useAsync } from '../lib/useAsync'
import {
  CRA_STATUS_LABELS,
  NOTE_FRAIS_STATUS_LABELS,
  ROLE_LABELS,
  formatMoney,
  monthLabel,
  statusBadge,
} from '../lib/format'
import { Link } from 'react-router-dom'

export function Dashboard() {
  const { user } = useAuth()
  const { selectedSoc, selectedSocId } = useSoc()
  const { data, loading, error, reload } = useAsync(() => dashboardApi.overview(), [selectedSocId], {
    enabled: !!user,
  })

  if (!user) return null

  const activeSocName = selectedSoc?.name ?? user.socName

  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Bonjour {user.firstName} 👋
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Voici un aperçu de votre activité
            {activeSocName ? ` chez ${activeSocName}` : ''} · {monthLabel(month)} {year}.
          </p>
        </div>
        <RefreshButton onClick={reload} />
      </div>

      {loading && <LoadingBlock />}
      {error && <ErrorBlock message={error} />}

      {data && (
        <>
          {user.role === 'ADMIN' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Utilisateurs" value={data.totalUsers ?? 0} to="/consultants" />
              <StatCard label="Sociétés" value={data.totalSocs ?? 0} to="/soc" />
              <StatCard label="Collaborateurs" value={data.totalConsultants ?? 0} to="/consultants" />
              <StatCard label="Abonnements actifs" value={data.activeSubscriptions ?? 0} to="/soc" />
            </div>
          )}

          {(user.role === 'RESPONSIBLE_SOC' || user.role === 'MANAGER') && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard label="Collaborateurs" value={data.consultants ?? 0} to="/consultants" />
              <StatCard
                label="Notes de frais en attente"
                value={data.pendingNoteFrais ?? 0}
                to="/notes-frais"
              />
              <Card className="p-5">
                <p className="text-sm font-bold text-gray-900">Cra cette année</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">{data.craYearTotal ?? 0}</p>
                <dl className="mt-3 space-y-2 border-t border-gray-100 pt-3">
                  <div className="flex items-center justify-between">
                    <dt className="text-sm font-medium text-gray-600">En attente de validation</dt>
                    <dd className="text-sm font-bold text-amber-600">
                      {data.craYearSubmitted ?? 0}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-sm font-medium text-gray-600">Validés</dt>
                    <dd className="text-sm font-bold text-green-600">
                      {data.craYearValidated ?? 0}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-sm font-medium text-gray-600">Rejetés</dt>
                    <dd className="text-sm font-bold text-red-600">
                      {data.craYearRejected ?? 0}
                    </dd>
                  </div>
                </dl>
                <Link
                  to="/cras"
                  className="mt-4 inline-block text-sm font-medium text-brand-600 hover:text-brand-700"
                >
                  Voir les CRA →
                </Link>
              </Card>
            </div>
          )}

          {user.role === 'CONSULTANT' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Card className="p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-500">Mon CRA du mois</p>
                  {data.craStatus && (
                    <Badge kind={statusBadge(data.craStatus)}>
                      {CRA_STATUS_LABELS[data.craStatus] ?? data.craStatus}
                    </Badge>
                  )}
                </div>
                <div className="mt-3 flex items-end gap-6">
                  <div>
                    <p className="text-2xl font-bold text-gray-900">
                      {data.craTotalHours ?? 0} h
                    </p>
                    <p className="text-xs text-gray-500">Heures</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">
                      {data.craTotalDays ?? 0} j
                    </p>
                    <p className="text-xs text-gray-500">Jours travaillés</p>
                  </div>
                </div>
                <Link
                  to="/cras"
                  className="mt-4 inline-block text-sm font-medium text-brand-600 hover:text-brand-700"
                >
                  Ouvrir mon CRA →
                </Link>
              </Card>

              <Card className="p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-500">Ma note de frais du mois</p>
                  {data.noteFraisStatus && (
                    <Badge kind={statusBadge(data.noteFraisStatus)}>
                      {NOTE_FRAIS_STATUS_LABELS[data.noteFraisStatus] ?? data.noteFraisStatus}
                    </Badge>
                  )}
                </div>
                <p className="mt-3 text-2xl font-bold text-gray-900">
                  {data.noteFraisTotal ? formatMoney(data.noteFraisTotal) : '—'}
                </p>
                <Link
                  to="/notes-frais"
                  className="mt-4 inline-block text-sm font-medium text-brand-600 hover:text-brand-700"
                >
                  Gérer mes notes de frais →
                </Link>
              </Card>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {user.role === 'ADMIN' && (
              <QuickLink to="/tables" title="Base de données" description="Gérer les tables et relations SQL" />
            )}
            {user.role === 'ADMIN' && (
              <QuickLink to="/logs" title="Logs du serveur" description="Voir les dernières lignes du journal serveur" />
            )}
            <QuickLink to="/notes-frais" title="Notes de frais" description="Gérer les remboursements et dépenses" />
            <QuickLink to="/clients" title="Clients" description="Gérer le portefeuille clients" />
            <QuickLink to="/missions" title="Missions" description="Suivre les missions en cours" />
          </div>
        </>
      )}

      <Card className="p-5">
        <h3 className="text-lg font-semibold text-gray-900">Mon profil</h3>
        <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <InfoRow label="Nom" value={`${user.firstName} ${user.lastName}`} />
          <InfoRow label="E-mail" value={user.email} />
          <InfoRow label="Rôle" value={ROLE_LABELS[user.role]} />
          <InfoRow label="Société" value={activeSocName ?? '—'} />
          <InfoRow label="Téléphone" value={user.phone ?? '—'} />
          <InfoRow label="Identifiant" value={user.username} />
        </dl>
      </Card>
    </div>
  )
}

function StatCard({ label, value, to }: { label: string; value: number; to: string }) {
  return (
    <Link to={to}>
      <Card className="p-5 transition hover:shadow-md">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
      </Card>
    </Link>
  )
}

function QuickLink({ to, title, description }: { to: string; title: string; description: string }) {
  return (
    <Link to={to}>
      <Card className="p-5 transition hover:border-brand-300 hover:shadow-md">
        <p className="font-semibold text-gray-900">{title}</p>
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      </Card>
    </Link>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="text-sm font-medium text-gray-900">{value}</dd>
    </div>
  )
}
