import { tr } from '../i18n/translate'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { projectsApi } from '../api/projects'
import { crasApi } from '../api/cras'
import { useAsync } from '../lib/useAsync'
import { Card, RefreshButton } from '../components/ui'
import { Badge, ErrorBlock, LoadingBlock, PageHeader } from '../components/data'
import { formatDate, formatMoney, monthLabel, monthShort } from '../lib/format'
import type { ProjectDto } from '../api/types'

type MissionStatus = 'active' | 'upcoming' | 'finished'

function missionStatus(p: ProjectDto): MissionStatus {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (!p.active) return 'finished'
  if (p.startDate) {
    const start = new Date(p.startDate + 'T00:00:00')
    if (start > today) return 'upcoming'
  }
  if (p.endDate) {
    const end = new Date(p.endDate + 'T00:00:00')
    if (end < today) return 'finished'
  }
  return 'active'
}

const STATUS_META: Record<MissionStatus, { label: string; kind: string }> = {
  active: { label: 'En cours', kind: 'success' },
  upcoming: { label: 'À venir', kind: 'info' },
  finished: { label: 'Terminée', kind: 'muted' },
}

export function Missions() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  const { data, loading, error, reload } = useAsync(
    () => projectsApi.findAll(isAdmin ? undefined : { socId: user?.socId ?? undefined }),
    [user?.socId, isAdmin],
  )

  const { data: monthCras } = useAsync(
    () =>
      user?.socId
        ? crasApi.findByMonth(year, month, user.socId)
        : Promise.resolve(null),
    [user?.socId, year, month],
  )

  if (!user) return null

  const missions = (data ?? [])
    .map((p) => ({ project: p, status: missionStatus(p) }))
    .sort((a, b) => {
      const order = { active: 0, upcoming: 1, finished: 2 }
      return order[a.status] - order[b.status]
    })

  const activeCount = missions.filter((m) => m.status === 'active').length
  const monthHours = (monthCras ?? []).reduce((sum, cra) => sum + cra.totalHours, 0)
  const monthValidated = (monthCras ?? []).filter((c) => c.status === 'VALIDATED').length
  const totalMonthlyRevenue = missions
    .filter((m) => m.status === 'active')
    .reduce((sum, m) => sum + (m.project.dailyRate ?? 0) * 21, 0)

  return (
    <div>
      <PageHeader
        title={tr('Missions.missions')}
        subtitle={tr('Missions.vue.operationnelle.des.missions.en.cours.a.venir.et.terminee')}
        actions={<RefreshButton onClick={reload} />}
      />

      {error && <ErrorBlock message={error} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <p className="text-sm font-medium text-gray-500">{tr('Missions.missions.en.cours')}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{activeCount}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm font-medium text-gray-500">
            {tr('Missions.ca.mensuel.estime.21.j.tjm')}
          </p>
          <p className="mt-2 text-3xl font-bold text-gray-900">
            {formatMoney(totalMonthlyRevenue)}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm font-medium text-gray-500">
            {tr('Missions.heures.saisies')} {monthShort(month)} {year}
          </p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{monthHours} {tr('Missions.h')}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm font-medium text-gray-500">
            {tr('Missions.cra.valides')} {monthShort(month)} {year}
          </p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{monthValidated}</p>
        </Card>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-gray-600">
          {tr('Missions.periode')}
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm"
          >
            {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading && <LoadingBlock />}

      {!loading && missions.length === 0 && (
        <div className="mt-6">
          <Card className="flex flex-col items-center justify-center py-14">
            <p className="text-sm font-medium text-gray-900">{tr('Missions.aucune.mission')}</p>
            <p className="mt-1 text-sm text-gray-500">
              {tr('Missions.creez.d.abord.des.projets.dans.le.module.projets')}
            </p>
            <Link
              to="/projets"
              className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              {tr('Missions.aller.aux.projets')}
            </Link>
          </Card>
        </div>
      )}

      {!loading && missions.length > 0 && (
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {missions.map(({ project, status }) => {
            const meta = STATUS_META[status]
            return (
              <Card key={project.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-gray-900">{project.name}</p>
                    <p className="mt-0.5 text-sm text-gray-500">
                      {project.client?.name ?? 'Client inconnu'}
                    </p>
                  </div>
                  <Badge kind={meta.kind}>{meta.label}</Badge>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3 border-t border-gray-100 pt-4 text-sm">
                  <div>
                    <p className="text-xs text-gray-500">{tr('Missions.periode.2')}</p>
                    <p className="font-medium text-gray-900">
                      {formatDate(project.startDate)} → {formatDate(project.endDate)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">{tr('Missions.tjm')}</p>
                    <p className="font-medium text-gray-900">
                      {formatMoney(project.dailyRate, project.currency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">{tr('Missions.ca.mensuel.estime')}</p>
                    <p className="font-medium text-gray-900">
                      {formatMoney((project.dailyRate ?? 0) * 21, project.currency)}
                    </p>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
