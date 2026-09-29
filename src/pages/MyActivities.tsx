import { tr } from '../i18n/translate'
import { useAuth } from '../auth/AuthContext'
import { activitiesApi } from '../api/activities'
import { useAsync } from '../lib/useAsync'
import { useDynamicTranslate } from '../lib/useDynamicTranslate'
import { RefreshButton } from '../components/ui'
import { Badge, EmptyState, ErrorBlock, LoadingBlock, PageHeader, Table } from '../components/data'
import type { ActivityDto } from '../api/types'

export function MyActivities() {
  const { user } = useAuth()
  const dt = useDynamicTranslate()

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
        title={tr('MyActivities.mes.activites')}
        titleId="MyActivities.mes.activites"
        count={(data ?? []).length}
        subtitle={tr('MyActivities.activites.qui.vous.sont.affectees.lecture.seule')}
        subtitleId="MyActivities.activites.qui.vous.sont.affectees.lecture.seule"
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
              label: tr('Activities.activite'),
              render: (a) => (
                <div>
                  <p className="font-medium text-gray-900">{a.name}</p>
                  {a.description && <p className="text-xs text-gray-500">{a.description}</p>}
                </div>
              ),
            },
            {
              key: 'type',
              label: tr('common.type'),
              render: (a) => <Badge kind="info">{a.type?.labelFr ?? '—'}</Badge>,
            },
            {
              key: 'project',
              label: tr('Projects.projet'),
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
              label: tr('common.period'),
              render: (a) => (
                <span className="text-gray-600">
                  {a.startDate ? a.startDate : '—'}
                  {a.endDate ? ` → ${a.endDate}` : a.startDate ? ' →' : ''}
                </span>
              ),
            },
            {
              key: 'allowed',
              label: tr('Activities.week.end.jours.feries'),
              render: (a) => (
                <div className="flex flex-col gap-1">
                  <Badge kind={a.weekendAllowed ? 'success' : 'muted'}>
                    {tr('Activities.week.end')} : {dt(a.weekendAllowed ? 'Oui' : 'Non')}
                  </Badge>
                  <Badge kind={a.holidayAllowed ? 'success' : 'muted'}>
                    {tr('Activities.jours.feries')} : {dt(a.holidayAllowed ? 'Oui' : 'Non')}
                  </Badge>
                </div>
              ),
            },
            {
              key: 'active',
              label: tr('common.status'),
              render: (a) => (
                <Badge kind={a.active ? 'success' : 'muted'}>
                  {dt(a.active ? 'Active' : 'Inactive')}
                </Badge>
              ),
            },
          ]}
        />
      )}

      {!loading && data && mine.length === 0 && (
        <EmptyState
          title={tr('MyActivities.aucune.activite')}
          description={tr('MyActivities.aucune.activite.ne.vous.est.affectee.pour.le.moment')}
        />
      )}
    </div>
  )
}
