import { api } from './client'

export interface ColumnDetails {
  columnName: string
  dataType: string
  nullable: boolean
  size?: number | null
  defaultValue?: string | null
}

export interface TableRelation {
  tableName: string
  columnName: string
  targetTable: string
  targetPk: string
}

export interface SqlExecutionResult {
  query: boolean
  rows: Record<string, unknown>[]
  affectedRows: number | null
  command: string
}

export const tablesApi = {
  list: () => api.get<string[]>('/tables'),
  getLines: (table: string) =>
    api.get<Record<string, unknown>[]>(`/tables/${encodeURIComponent(table)}`),
  getColumns: (table: string) =>
    api.get<ColumnDetails[]>(`/tables/${encodeURIComponent(table)}/columns`),
  executeSql: (sql: string) => api.postText<SqlExecutionResult>('/tables/execute', sql),
  getRelations: () => api.get<TableRelation[]>('/tables/relations'),
}
