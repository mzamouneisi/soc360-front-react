import { tr } from '../i18n/translate'
import type { CSSProperties } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useSoc } from '../soc/SocContext'
import { Card, RefreshButton } from '../components/ui'
import { Badge, LoadingBlock, ErrorBlock } from '../components/data'
import { dashboardApi } from '../api/dashboard'
import { useAsync } from '../lib/useAsync'
import { useDynamicTranslate } from '../lib/useDynamicTranslate'
import {
  CRA_STATUS_LABELS,
  NOTE_FRAIS_STATUS_LABELS,
  ROLE_LABELS,
  formatMoney,
  monthLabel,
  statusBadge,
} from '../lib/format'
import { Link } from 'react-router-dom'

const DASH_CARD: CSSProperties = {
  backgroundColor: 'var(--app-card-bg)',
  borderColor: 'var(--app-card-border)',
}

export function Dashboard() {
  const { user } = useAuth()
  const dt = useDynamicTranslate()
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
          <h2 className="text-2xl font-bold text-gray-900" id="Dashboard.bonjour">
            {tr('Dashboard.bonjour')} {user.firstName} 👋
          </h2>
          <p id="Dashboard.voici.un.apercu.de.votre.activite" className="mt-1 text-sm text-gray-500">
            {tr('Dashboard.voici.un.apercu.de.votre.activite')}
            {activeSocName ? ` ${tr('Dashboard.chez')} ${activeSocName}` : ''} · {monthLabel(month)} {year}.
          </p>
        </div>
        <RefreshButton onClick={reload} />
      </div>

      {loading && <LoadingBlock />}
      {error && <ErrorBlock id="Dashboard.error" message={error} />}

      {data && (
        <>
          {user.role === 'ADMIN' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard id="Dashboard.utilisateurs" label={tr('Dashboard.utilisateurs')} value={data.totalUsers ?? 0} to="/consultants" />
              <StatCard id="Dashboard.societes" label={tr('Dashboard.societes')} value={data.totalSocs ?? 0} to="/soc" />
              <StatCard id="Dashboard.collaborateurs" label={tr('Dashboard.collaborateurs')} value={data.totalConsultants ?? 0} to="/consultants" />
              <StatCard id="Dashboard.abonnements.actifs" label={tr('Dashboard.abonnements.actifs')} value={data.activeSubscriptions ?? 0} to="/soc" />
            </div>
          )}

          {(user.role === 'RESPONSIBLE_SOC' || user.role === 'MANAGER') && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard id="Dashboard.collaborateurs.2" label={tr('Dashboard.collaborateurs')} value={data.consultants ?? 0} to="/consultants" />
              <StatCard
                id="Dashboard.notes.de.frais.en.attente"
                label={tr('Dashboard.notes.de.frais.en.attente')}
                value={data.pendingNoteFrais ?? 0}
                to="/notes-frais"
              />
              <Card id="Dashboard.card.craYear" className="p-5" style={DASH_CARD}>
                <p id="Dashboard.cra.cette.annee" className="text-sm font-bold text-gray-900">{tr('Dashboard.cra.cette.annee')}</p>
                <p id="Dashboard.craYear.value" className="mt-2 text-3xl font-bold text-gray-900">{data.craYearTotal ?? 0}</p>
                <dl className="mt-3 space-y-2 border-t border-gray-100 pt-3">
                  <div className="flex items-center justify-between">
                    <dt id="Dashboard.en.attente.de.validation" className="text-sm font-medium text-gray-600">{tr('Dashboard.en.attente.de.validation')}</dt>
                    <dd id="Dashboard.craYear.submitted" className="text-sm font-bold text-amber-600">
                      {data.craYearSubmitted ?? 0}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt id="Dashboard.valides" className="text-sm font-medium text-gray-600">{tr('Dashboard.valides')}</dt>
                    <dd id="Dashboard.craYear.validated" className="text-sm font-bold text-green-600">
                      {data.craYearValidated ?? 0}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt id="Dashboard.rejetes" className="text-sm font-medium text-gray-600">{tr('Dashboard.rejetes')}</dt>
                    <dd id="Dashboard.craYear.rejected" className="text-sm font-bold text-red-600">
                      {data.craYearRejected ?? 0}
                    </dd>
                  </div>
                </dl>
                <Link
                  id="Dashboard.voir.les.cra"
                  to="/cras"
                  className="mt-4 inline-block text-sm font-medium text-brand-600 hover:text-brand-700"
                >
                  {tr('Dashboard.voir.les.cra')}
                </Link>
              </Card>
            </div>
          )}

          {user.role === 'CONSULTANT' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Card id="Dashboard.card.myCra" className="p-5" style={DASH_CARD}>
                <div className="flex items-center justify-between">
                  <p id="Dashboard.mon.cra.du.mois" className="text-sm font-medium text-gray-500">{tr('Dashboard.mon.cra.du.mois')}</p>
                  {data.craStatus && (
                    <Badge id="Dashboard.myCra.status" kind={statusBadge(data.craStatus)}>
                      {dt(CRA_STATUS_LABELS[data.craStatus] ?? data.craStatus)}
                    </Badge>
                  )}
                </div>
                <div className="mt-3 flex items-end gap-6">
                  <div>
                    <p id="Dashboard.myCra.hours" className="text-2xl font-bold text-gray-900">
                      {data.craTotalHours ?? 0} {tr('Dashboard.h')}
                    </p>
                    <p id="Dashboard.heures" className="text-xs text-gray-500">{tr('Dashboard.heures')}</p>
                  </div>
                  <div>
                    <p id="Dashboard.myCra.days" className="text-2xl font-bold text-gray-900">
                      {data.craTotalDays ?? 0} {tr('Dashboard.j')}
                    </p>
                    <p id="Dashboard.jours.travailles" className="text-xs text-gray-500">{tr('Dashboard.jours.travailles')}</p>
                  </div>
                </div>
                <Link
                  id="Dashboard.ouvrir.mon.cra"
                  to="/cras"
                  className="mt-4 inline-block text-sm font-medium text-brand-600 hover:text-brand-700"
                >
                  {tr('Dashboard.ouvrir.mon.cra')}
                </Link>
              </Card>

              <Card id="Dashboard.card.myNotes" className="p-5" style={DASH_CARD}>
                <div className="flex items-center justify-between">
                  <p id="Dashboard.ma.note.de.frais.du.mois" className="text-sm font-medium text-gray-500">{tr('Dashboard.ma.note.de.frais.du.mois')}</p>
                  {data.noteFraisStatus && (
                    <Badge id="Dashboard.myNotes.status" kind={statusBadge(data.noteFraisStatus)}>
                      {dt(NOTE_FRAIS_STATUS_LABELS[data.noteFraisStatus] ?? data.noteFraisStatus)}
                    </Badge>
                  )}
                </div>
                <p id="Dashboard.myNotes.total" className="mt-3 text-2xl font-bold text-gray-900">
                  {data.noteFraisTotal ? formatMoney(data.noteFraisTotal) : '—'}
                </p>
                <Link
                  id="Dashboard.gerer.mes.notes.de.frais"
                  to="/notes-frais"
                  className="mt-4 inline-block text-sm font-medium text-brand-600 hover:text-brand-700"
                >
                  {tr('Dashboard.gerer.mes.notes.de.frais')}
                </Link>
              </Card>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {user.role === 'ADMIN' && (
              <>
                <QuickLink id="Dashboard.base.de.donnees" descriptionId="Dashboard.gerer.les.tables.et.relations.sql" to="/tables" title={tr('Dashboard.base.de.donnees')} description={tr('Dashboard.gerer.les.tables.et.relations.sql')} />
                <QuickLink id="Dashboard.logs.du.serveur" descriptionId="Dashboard.voir.les.dernieres.lignes.du.journal.serveur" to="/logs" title={tr('Dashboard.logs.du.serveur')} description={tr('Dashboard.voir.les.dernieres.lignes.du.journal.serveur')} />
                <QuickLink id="Dashboard.langues" descriptionId="Dashboard.gerer.les.langues.et.les.traductions" to="/langues" title={tr('Dashboard.langues')} description={tr('Dashboard.gerer.les.langues.et.les.traductions')} />
              </>
            )}
            {user.role === 'CONSULTANT' ? (
              <>
                <QuickLink id="nav.myActivities.2" descriptionId="Dashboard.mes.activites.description" to="/mes-activites" title={tr('nav.myActivities')} description={tr('Dashboard.mes.activites.description')} />
                <QuickLink id="nav.cra.2" descriptionId="Dashboard.cra.description" to="/cras" title={tr('nav.cra')} description={tr('Dashboard.cra.description')} />
                <QuickLink id="nav.unavailability.2" descriptionId="Dashboard.indisponibilites.description" to="/indisponibilites" title={tr('nav.unavailability')} description={tr('Dashboard.indisponibilites.description')} />
                <QuickLink id="Dashboard.notes.de.frais" descriptionId="Dashboard.gerer.les.remboursements.et.depenses" to="/notes-frais" title={tr('Dashboard.notes.de.frais')} description={tr('Dashboard.gerer.les.remboursements.et.depenses')} />
              </>
            ) : (
              <>
                <QuickLink id="Dashboard.notes.de.frais.2" descriptionId="Dashboard.gerer.les.remboursements.et.depenses.2" to="/notes-frais" title={tr('Dashboard.notes.de.frais')} description={tr('Dashboard.gerer.les.remboursements.et.depenses')} />
                <QuickLink id="Dashboard.clients" descriptionId="Dashboard.gerer.le.portefeuille.clients" to="/clients" title={tr('Dashboard.clients')} description={tr('Dashboard.gerer.le.portefeuille.clients')} />
                <QuickLink id="Dashboard.missions" descriptionId="Dashboard.suivre.les.missions.en.cours" to="/missions" title={tr('Dashboard.missions')} description={tr('Dashboard.suivre.les.missions.en.cours')} />
              </>
            )}
          </div>
        </>
      )}

      <Card id="Dashboard.profile" className="p-5" style={DASH_CARD}>
        <h3 className="text-lg font-semibold text-gray-900" id="Dashboard.mon.profil">{tr('Dashboard.mon.profil')}</h3>
        <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <InfoRow id="Dashboard.nom" label={tr('Dashboard.nom')} value={`${user.firstName} ${user.lastName}`} />
          <InfoRow id="Dashboard.e.mail" label={tr('Dashboard.e.mail')} value={user.email} />
          <InfoRow id="Dashboard.role" label={tr('Dashboard.role')} value={dt(ROLE_LABELS[user.role])} />
          <InfoRow id="Dashboard.societe" label={tr('Dashboard.societe')} value={activeSocName ?? '—'} />
          <InfoRow id="Dashboard.telephone" label={tr('Dashboard.telephone')} value={user.phone ?? '—'} />
          <InfoRow id="Dashboard.identifiant" label={tr('Dashboard.identifiant')} value={user.username} />
        </dl>
      </Card>
    </div>
  )
}

function StatCard({ label, value, to, id }: { label: string; value: number; to: string; id?: string }) {
  return (
    <Link id={id ? `${id}.link` : undefined} to={to}>
      <Card id={id ? `${id}.card` : undefined} className="p-5 transition hover:shadow-md" style={DASH_CARD}>
        <p id={id} className="text-sm font-medium text-gray-500">{label}</p>
        <p id={id ? `${id}.value` : undefined} className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
      </Card>
    </Link>
  )
}

function QuickLink({ to, title, description, id, descriptionId }: { to: string; title: string; description: string; id?: string; descriptionId?: string }) {
  return (
    <Link id={id ? `${id}.link` : undefined} to={to}>
      <Card id={id ? `${id}.card` : undefined} className="p-5 transition hover:border-brand-300 hover:shadow-md" style={DASH_CARD}>
        <p id={id} className="font-semibold text-gray-900">{title}</p>
        <p id={descriptionId} className="mt-1 text-sm text-gray-500">{description}</p>
      </Card>
    </Link>
  )
}

function InfoRow({ label, value, id }: { label: string; value: string; id?: string }) {
  return (
    <div>
      <dt id={id} className="text-sm text-gray-500">{label}</dt>
      <dd id={id ? `${id}.value` : undefined} className="text-sm font-medium text-gray-900">{value}</dd>
    </div>
  )
}
