import { useAuth } from '../auth/AuthContext'
import { activitiesApi } from '../api/activities'
import { useAsync } from '../lib/useAsync'
import { RefreshButton } from '../components/ui'
import { Badge, EmptyState, ErrorBlock, LoadingBlock, PageHeader, Table } from '../components/data'
import { formatMoney } from '../lib/format'
import type { ActivityDto } from '../api/types'

export function MyActivities() {
  const { user } = useAuth()

  const { data, loading, error, reload } = useAsync(
    () =>
      activitiesApi.findAll({
        socId: user?.socId ?? undefined,
        consultantId: user?.id,
      }),
    [user?.socId, user?.id],
    { enabled: !!user },
  )

  if (!user) return null

  const mine: ActivityDto[] = (data ?? []).filter((a) => a.consultant?.id === user.id)

  return (
    <div>
      <PageHeader
        title="Mes activités"
        subtitle="Activités qui vous sont affectées (lecture seule)"
        actions={<RefreshButton onClick={reload} />}
      />

      {error && <ErrorBlock message={error} />}
      {loading && <LoadingBlock />}

      {!loading && mine.length > 0 && (
        <Table
          paginate
          rowKey={(a) => a.id}
          rows={mine}
          columns={[
            {
              key: 'name',
              label: 'Activité',
              render: (a) => (
                <div>
                  <p className="font-medium text-gray-900">{a.name}</p>
                  {a.description && <p className="text-xs text-gray-500">{a.description}</p>}
                </div>
              ),
            },
            {
              key: 'type',
              label: 'Type',
              render: (a) => <Badge kind="info">{a.type?.labelFr ?? '—'}</Badge>,
            },
            {
              key: 'project',
              label: 'Projet',
              render: (a) => (
                <div>
                  <p className="font-medium text-gray-900">{a.project?.name ?? '—'}</p>
                  {a.project?.clientName && (
                    <p className="text-xs text-gray-500">{a.project.clientName}</p>
                  )}
                </div>
              ),
            },
            {
              key: 'period',
              label: 'Période',
              render: (a) => (
                <span className="text-gray-600">
                  {a.startDate ? a.startDate : '—'}
                  {a.endDate ? ` → ${a.endDate}` : a.startDate ? ' →' : ''}
                </span>
              ),
            },
            {
              key: 'price',
              label: 'Tarif',
              render: (a) => (
                <span className="font-medium text-gray-900">{formatMoney(a.price, a.currency)}</span>
              ),
            },
            {
              key: 'allowed',
              label: 'Week-end / Jours fériés',
              render: (a) => (
                <div className="flex flex-col gap-1">
                  <Badge kind={a.weekendAllowed ? 'success' : 'muted'}>
                    Week-end : {a.weekendAllowed ? 'Oui' : 'Non'}
                  </Badge>
                  <Badge kind={a.holidayAllowed ? 'success' : 'muted'}>
                    Jours fériés : {a.holidayAllowed ? 'Oui' : 'Non'}
                  </Badge>
                </div>
              ),
            },
            {
              key: 'active',
              label: 'Statut',
              render: (a) => (
                <Badge kind={a.active ? 'success' : 'muted'}>{a.active ? 'Active' : 'Inactive'}</Badge>
              ),
            },
          ]}
        />
      )}

      {!loading && data && mine.length === 0 && (
        <EmptyState
          title="Aucune activité"
          description="Aucune activité ne vous est affectée pour le moment."
        />
      )}
    </div>
  )
}
