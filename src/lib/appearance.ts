import type { EffectiveAppearanceDto } from '../api/types'

const COLOR_VARIABLES: Record<string, string> = {
  backgroundColor: '--app-bg-color',
  tableHeaderColor: '--table-header',
  tableHeaderTextColor: '--table-header-text',
  tableBorderColor: '--table-border',
  formHeaderBackgroundColor: '--form-header-bg',
  formHeaderTextColor: '--form-header-text',
  formLabelTextColor: '--form-label-text',
  buttonSaveColor: '--btn-save-color',
  buttonDeleteColor: '--btn-delete-color',
  buttonCancelColor: '--btn-cancel-color',
  buttonCancelTextColor: '--btn-cancel-text-color',
  buttonSubmitColor: '--btn-submit-color',
  buttonSubmitTextColor: '--btn-submit-text-color',
  buttonHistoryColor: '--btn-history-color',
  buttonHistoryTextColor: '--btn-history-text-color',
  buttonOkColor: '--btn-ok-color',
  buttonOkTextColor: '--btn-ok-text-color',
  buttonNewColor: '--btn-new-color',
  buttonNewTextColor: '--btn-new-text-color',
  buttonDisableColor: '--btn-disable-color',
  buttonDisableTextColor: '--btn-disable-text-color',
}

const PIXEL_VARIABLES: Record<string, string> = {
  tableHeaderFontSize: '--table-header-font-size',
  formHeaderFontSize: '--form-header-font-size',
  formLabelFontSize: '--form-label-font-size',
  buttonSmallWidth: '--btn-small-width',
  buttonLargeWidth: '--btn-large-width',
}

/** Applique l'apparence effective (héritage utilisateur → société → SOC360) au document. */
export function applyAppearance(effective: EffectiveAppearanceDto): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const config = effective.config ?? {}

  if (config.fontSize) root.style.fontSize = `${config.fontSize}px`
  if (config.theme) root.dataset.theme = config.theme

  for (const [key, variable] of Object.entries(COLOR_VARIABLES)) {
    const value = config[key]
    if (value) root.style.setProperty(variable, value)
  }
  for (const [key, variable] of Object.entries(PIXEL_VARIABLES)) {
    const value = config[key]
    if (value) root.style.setProperty(variable, `${value}px`)
  }
}
