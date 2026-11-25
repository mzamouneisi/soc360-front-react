import { tr } from '../i18n/translate'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'
import { authApi } from '../api/auth'
import { socsApi } from '../api/socs'
import { useSoc } from '../soc/SocContext'
import { emailTemplatesApi, type EmailTemplateView } from '../api/emailTemplates'
import { i18nApi, type TranslatedEntry } from '../api/i18n'
import { ApiError } from '../api/client'
import { Card, Field, IconButton, Input, Select, Spinner, Button, Textarea } from '../components/ui'
import { SocLogoField } from '../components/SocLogoField'
import { PageHeader } from '../components/data'
import { dialog } from '../components/dialog'
import { languageLabel } from '../i18n/messages'
import { useI18n } from '../i18n'
import { DEFAULT_VAT_RATE } from '../lib/vat'
import { appearanceApi } from '../api/appearance'
import { applyAppearance } from '../lib/appearance'
import type { AppearanceScope, SocDto } from '../api/types'

const FONT_SIZES = [10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 22, 24]

/** Affiche le contenu de l'onglet actif uniquement. */
function TabPanel({ active, children }: { active: boolean; children: ReactNode }) {
  return active ? <>{children}</> : null
}

const CRA_LEAVE_COLOR_DEFAULT = '#fef9c3'
const CRA_WEEKEND_COLOR_DEFAULT = '#fefce8'

const THEMES: { id: string; color: string }[] = [
  { id: 'ocean', color: '#3367f6' },
  { id: 'forest', color: '#2aa35a' },
  { id: 'sunset', color: '#f97316' },
  { id: 'lilac', color: '#8b5cf6' },
  { id: 'emerald', color: '#14b8a6' },
  { id: 'ruby', color: '#ef4444' },
  { id: 'amber', color: '#f59e0b' },
  { id: 'sky', color: '#0ea5e9' },
  { id: 'slate', color: '#64748b' },
  { id: 'rose', color: '#f43f5e' },
]

// Mémorise l'état de la section « Traductions de la société » à travers le rechargement
// du bundle i18n (qui remonte le composant) déclenché après un enregistrement/suppression.
const trUiMemory = { search: '', selectedKey: '', override: '' }

const RETRAD_INPUT_ID = 'retrad_for_soc_and_lang'

function findScrollParent(element: HTMLElement): HTMLElement | null {
  let parent = element.parentElement
  while (parent) {
    const overflowY = window.getComputedStyle(parent).overflowY
    if ((overflowY === 'auto' || overflowY === 'scroll') && parent.scrollHeight > parent.clientHeight) {
      return parent
    }
    parent = parent.parentElement
  }
  return null
}

function scrollToAndFocus(input: HTMLInputElement): void {
  const scroller = findScrollParent(input)
  if (scroller) {
    const target =
      input.getBoundingClientRect().top -
      scroller.getBoundingClientRect().top +
      scroller.scrollTop -
      scroller.clientHeight / 2 +
      input.clientHeight / 2
    scroller.scrollTo({ top: Math.max(0, target), behavior: 'smooth' })
  } else {
    input.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }
  input.focus({ preventScroll: true })
}

let retradScrollTimer: number | null = null

/**
 * Fait défiler la page jusqu'à l'input de re-traduction et lui redonne le focus dès qu'il est
 * disponible/actif (le rechargement du bundle i18n remonte le composant, ce qui recrée le DOM).
 */
function scheduleScrollToRetrad(): void {
  if (retradScrollTimer != null) window.clearTimeout(retradScrollTimer)
  let attempts = 0
  const tick = () => {
    const input = document.getElementById(RETRAD_INPUT_ID)
    if (input instanceof HTMLInputElement && !input.disabled) {
      retradScrollTimer = null
      scrollToAndFocus(input)
      return
    }
    if (attempts++ < 40) {
      retradScrollTimer = window.setTimeout(tick, 100)
    } else {
      retradScrollTimer = null
    }
  }
  tick()
}

export function Settings() {
  const { user, refreshMe } = useAuth()
  const { selectedSocId, selectedSoc, refreshSocs } = useSoc()
  const { t, preference, languages, setLanguage, language, refresh } = useI18n()
  const [size, setSize] = useState<number>(user?.fontSize ?? 14)
  const [theme, setTheme] = useState<string>(user?.theme || 'ocean')
  const [headerColor, setHeaderColor] = useState<string>(user?.tableHeaderColor || '#1d48eb')
  const [headerTextColor, setHeaderTextColor] = useState<string>(user?.tableHeaderTextColor || '#ffffff')
  const [borderColor, setBorderColor] = useState<string>(user?.tableBorderColor || '#000000')
  const [tableHeaderFontSize, setTableHeaderFontSize] = useState<number>(user?.tableHeaderFontSize ?? 15)
  const [formHeaderBg, setFormHeaderBg] = useState<string>(user?.formHeaderBackgroundColor || '#0ea5e9')
  const [formHeaderText, setFormHeaderText] = useState<string>(user?.formHeaderTextColor || '#ffffff')
  const [formHeaderFontSize, setFormHeaderFontSize] = useState<number>(user?.formHeaderFontSize ?? 15)
  const [formLabelText, setFormLabelText] = useState<string>(user?.formLabelTextColor || '#0ea5e9')
  const [formLabelFontSize, setFormLabelFontSize] = useState<number>(user?.formLabelFontSize ?? 12)
  const [pageSize, setPageSize] = useState<number>(user?.pageSize ?? 5)
  const [btnSmallWidth, setBtnSmallWidth] = useState<number>(user?.buttonSmallWidth ?? 50)
  const [btnLargeWidth, setBtnLargeWidth] = useState<number>(user?.buttonLargeWidth ?? 100)
  const [btnSaveColor, setBtnSaveColor] = useState<string>(user?.buttonSaveColor || '#1d48eb')
  const [btnDeleteColor, setBtnDeleteColor] = useState<string>(user?.buttonDeleteColor || '#dc2626')
  const [btnCancelColor, setBtnCancelColor] = useState<string>(user?.buttonCancelColor || '#ffffff')
  const [btnCancelTextColor, setBtnCancelTextColor] = useState<string>(user?.buttonCancelTextColor || '#374151')
  const [btnSubmitColor, setBtnSubmitColor] = useState<string>(user?.buttonSubmitColor || '#e0e7ff')
  const [btnSubmitTextColor, setBtnSubmitTextColor] = useState<string>(user?.buttonSubmitTextColor || '#1d48eb')
  const [btnHistoryColor, setBtnHistoryColor] = useState<string>(user?.buttonHistoryColor || '#e0e7ff')
  const [btnHistoryTextColor, setBtnHistoryTextColor] = useState<string>(user?.buttonHistoryTextColor || '#1d48eb')
  const [btnOkColor, setBtnOkColor] = useState<string>(user?.buttonOkColor || '#16a34a')
  const [btnOkTextColor, setBtnOkTextColor] = useState<string>(user?.buttonOkTextColor || '#ffffff')
  const [btnNewColor, setBtnNewColor] = useState<string>(user?.buttonNewColor || '#0ea5e9')
  const [btnNewTextColor, setBtnNewTextColor] = useState<string>(user?.buttonNewTextColor || '#ffffff')
  const [btnDisableColor, setBtnDisableColor] = useState<string>(user?.buttonDisableColor || '#f97316')
  const [btnDisableTextColor, setBtnDisableTextColor] = useState<string>(user?.buttonDisableTextColor || '#ffffff')
  const [bgColor, setBgColor] = useState<string>(user?.backgroundColor || '#bae6fd')
  const [leaveDayColor, setLeaveDayColor] = useState<string>(CRA_LEAVE_COLOR_DEFAULT)
  const [weekendColor, setWeekendColor] = useState<string>(CRA_WEEKEND_COLOR_DEFAULT)
  const [vatRate, setVatRate] = useState<string>(String(DEFAULT_VAT_RATE))
  const [savedVatRate, setSavedVatRate] = useState<string>(String(DEFAULT_VAT_RATE))
  const [socHasLogo, setSocHasLogo] = useState<boolean>(selectedSoc?.hasLogo ?? false)
  const [, setLogoChanged] = useState(false)
  const [savedLeaveDayColor, setSavedLeaveDayColor] = useState<string>(CRA_LEAVE_COLOR_DEFAULT)
  const [savedWeekendColor, setSavedWeekendColor] = useState<string>(CRA_WEEKEND_COLOR_DEFAULT)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  // Activé dès qu'un champ des paramètres est modifié (active le bouton Enregistrer).
  const [dirty, setDirty] = useState(false)
  const dirtyRef = useRef(false)
  const appliedAppearanceKeyRef = useRef<string | null>(null)
  const [languageSaving, setLanguageSaving] = useState(false)
  const [languageSaved, setLanguageSaved] = useState(false)
  const [languageError, setLanguageError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('general')
  const [appearanceTab, setAppearanceTab] = useState<'application' | 'buttons' | 'forms' | 'tables'>('application')
  // L'administrateur ne dépend d'aucune société : il choisit celle à paramétrer dans l'onglet Société.
  const [adminSocs, setAdminSocs] = useState<SocDto[]>([])
  const [adminSocId, setAdminSocId] = useState<number | null>(null)

  const isAdmin = user?.role === 'ADMIN'
  const canEditTemplates = user?.role === 'ADMIN' || user?.role === 'RESPONSIBLE_SOC'
  // Les paramètres société (logo, couleurs CRA, TVA) sont gérables par le responsable et l'admin.
  const canManageCompany = user?.role === 'ADMIN' || user?.role === 'RESPONSIBLE_SOC'
  const companySocId = isAdmin ? adminSocId : selectedSocId
  const companySoc = isAdmin
    ? adminSocs.find((s) => s.id === adminSocId) ?? null
    : selectedSoc
  // L'admin définit l'apparence SOC360 (GLOBAL, référence des restaurations), le responsable celle
  // de sa société, les autres une apparence personnelle.
  const appearanceScope: AppearanceScope = user?.role === 'ADMIN'
    ? 'GLOBAL'
    : user?.role === 'RESPONSIBLE_SOC'
      ? 'SOC'
      : 'USER'
  const appearanceRestoreLabel = user?.role === 'RESPONSIBLE_SOC'
    ? 'Restaurer le paramétrage SOC360'
    : 'Restaurer le paramétrage de ma société'
  const tabs: { id: string; labelKey: string; label?: string }[] = [
    { id: 'general', labelKey: 'settings.tab.general' },
    { id: 'appearance', labelKey: 'settings.tab.appearance' },
    ...(canManageCompany ? [{ id: 'company', labelKey: 'settings.tab.company' }] : []),
    ...(canEditTemplates
      ? [
          { id: 'translations', labelKey: 'settings.tab.translations' },
          { id: 'emails', labelKey: 'settings.tab.emails' },
        ]
      : []),
  ]

  useEffect(() => {
    if (!isAdmin) {
      return
    }
    let cancelled = false
    socsApi
      .findAll()
      .then((list) => {
        if (cancelled) return
        setAdminSocs(list)
        setAdminSocId((current) => {
          if (current != null && list.some((s) => s.id === current)) return current
          return list[0]?.id ?? null
        })
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [isAdmin])

  useEffect(() => {
    if (!companySocId || !canManageCompany) {
      return
    }
    let cancelled = false
    socsApi
      .getById(companySocId)
      .then(({ soc }) => {
        if (cancelled) return
        const leave = soc.leaveDayColor || CRA_LEAVE_COLOR_DEFAULT
        const weekend = soc.weekendColor || CRA_WEEKEND_COLOR_DEFAULT
        const vat = soc.vatRate != null ? String(soc.vatRate) : String(DEFAULT_VAT_RATE)
        setLeaveDayColor(leave)
        setWeekendColor(weekend)
        setVatRate(vat)
        setSavedLeaveDayColor(leave)
        setSavedWeekendColor(weekend)
        setSavedVatRate(vat)
        setSocHasLogo(soc.hasLogo ?? false)
        setLogoChanged(false)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [companySocId, canManageCompany])
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplateView[]>([])
  const [templateKey, setTemplateKey] = useState('')
  const [templateSubject, setTemplateSubject] = useState('')
  const [templateBody, setTemplateBody] = useState('')
  const [templateLoading, setTemplateLoading] = useState(false)
  const [templateSaving, setTemplateSaving] = useState(false)
  const [templateError, setTemplateError] = useState<string | null>(null)
  const [templateSaved, setTemplateSaved] = useState(false)
  const selectedTemplate = emailTemplates.find((item) => item.key === templateKey) ?? null

  const [trEntries, setTrEntries] = useState<TranslatedEntry[]>([])
  const [trSearch, setTrSearch] = useState(() => trUiMemory.search)
  const [trSelectedKey, setTrSelectedKey] = useState(() => trUiMemory.selectedKey)
  const [trOverride, setTrOverride] = useState(() => trUiMemory.override)
  const [trLoading, setTrLoading] = useState(false)
  const [trSaving, setTrSaving] = useState(false)
  const [trError, setTrError] = useState<string | null>(null)
  const [trMessage, setTrMessage] = useState<string | null>(null)
  const trSelected = trEntries.find((entry) => entry.key === trSelectedKey) ?? null
  const trFiltered = trEntries.filter((entry) => {
    const q = trSearch.trim().toLowerCase()
    if (!q) return true
    return (
      entry.key.toLowerCase().includes(q) ||
      entry.value.toLowerCase().includes(q) ||
      (entry.override ?? '').toLowerCase().includes(q)
    )
  })

  useEffect(() => {
    if (!canEditTemplates) return
    let cancelled = false
    setTemplateLoading(true)
    emailTemplatesApi
      .list()
      .then((list) => {
        if (cancelled) return
        setEmailTemplates(list)
        setTemplateKey((current) => current || list[0]?.key || '')
      })
      .catch(() => {
        if (!cancelled) setTemplateError(t('settings.emailTemplates.loadError'))
      })
      .finally(() => {
        if (!cancelled) setTemplateLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [canEditTemplates, t])

  useEffect(() => {
    if (!selectedTemplate) return
    setTemplateSubject(selectedTemplate.subject)
    setTemplateBody(selectedTemplate.body)
    setTemplateSaved(false)
    setTemplateError(null)
  }, [selectedTemplate])

  useEffect(() => {
    if (!canEditTemplates) return
    let cancelled = false
    setTrLoading(true)
    i18nApi
      .companyEntries(language)
      .then((list) => {
        if (!cancelled) setTrEntries(list)
      })
      .catch(() => {
        if (!cancelled) setTrError(t('settings.companyTranslations.loadError'))
      })
      .finally(() => {
        if (!cancelled) setTrLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [canEditTemplates, language, t])

  useEffect(() => {
    if (!trSelected) return
    setTrOverride(trSelected.override ?? '')
    setTrMessage(null)
    setTrError(null)
  }, [trSelected])

  useEffect(() => {
    trUiMemory.search = trSearch
  }, [trSearch])

  useEffect(() => {
    trUiMemory.selectedKey = trSelectedKey
  }, [trSelectedKey])

  useEffect(() => {
    trUiMemory.override = trOverride
  }, [trOverride])

  useEffect(() => {
    let cancelled = false
    if (!user) return
    appearanceApi
      .effective()
      .then((eff) => {
        // Ne pas écraser une saisie déjà commencée (évite d'avoir à ressaisir une valeur).
        if (cancelled || dirtyRef.current) return
        // N'applique la configuration qu'une fois pour un couple utilisateur/société afin qu'une
        // ré-exécution de l'effet ne réinitialise pas la valeur choisie.
        const key = `${user.id}-${selectedSocId ?? 'none'}`
        if (appliedAppearanceKeyRef.current === key) return
        appliedAppearanceKeyRef.current = key
        applyAppearanceConfig(eff.config)
        applyAppearance(eff)
      })
      .catch(() => {
        // Apparence optionnelle : on conserve les valeurs par défaut en cas d'erreur.
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.socId, user?.role, selectedSocId])

  if (!user) return null
  const u = user

  async function handleLanguageChange(value: string) {
    setLanguageSaving(true)
    setLanguageSaved(false)
    setLanguageError(null)
    try {
      await setLanguage(value === 'browser' ? null : value)
      setLanguageSaved(true)
    } catch (err) {
      setLanguageError(err instanceof ApiError ? err.message : tr('common.unexpectedError'))
    } finally {
      setLanguageSaving(false)
    }
  }

  function applyAppearanceConfig(config: Record<string, string>) {
    const number = (key: string, fallback: number) => {
      const value = Number(config[key])
      return Number.isFinite(value) && value > 0 ? value : fallback
    }
    setSize(number('fontSize', 14))
    setTheme(config.theme || 'ocean')
    setBgColor(config.backgroundColor || '#bae6fd')
    setPageSize(number('pageSize', 5))
    setHeaderColor(config.tableHeaderColor || '#1d48eb')
    setHeaderTextColor(config.tableHeaderTextColor || '#ffffff')
    setBorderColor(config.tableBorderColor || '#000000')
    setTableHeaderFontSize(number('tableHeaderFontSize', 15))
    setFormHeaderBg(config.formHeaderBackgroundColor || '#0ea5e9')
    setFormHeaderText(config.formHeaderTextColor || '#ffffff')
    setFormHeaderFontSize(number('formHeaderFontSize', 15))
    setFormLabelText(config.formLabelTextColor || '#0ea5e9')
    setFormLabelFontSize(number('formLabelFontSize', 12))
    setBtnSmallWidth(number('buttonSmallWidth', 50))
    setBtnLargeWidth(number('buttonLargeWidth', 100))
    setBtnSaveColor(config.buttonSaveColor || '#1d48eb')
    setBtnDeleteColor(config.buttonDeleteColor || '#dc2626')
    setBtnCancelColor(config.buttonCancelColor || '#ffffff')
    setBtnCancelTextColor(config.buttonCancelTextColor || '#374151')
    setBtnSubmitColor(config.buttonSubmitColor || '#e0e7ff')
    setBtnSubmitTextColor(config.buttonSubmitTextColor || '#1d48eb')
    setBtnHistoryColor(config.buttonHistoryColor || '#e0e7ff')
    setBtnHistoryTextColor(config.buttonHistoryTextColor || '#1d48eb')
    setBtnOkColor(config.buttonOkColor || '#16a34a')
    setBtnOkTextColor(config.buttonOkTextColor || '#ffffff')
    setBtnNewColor(config.buttonNewColor || '#0ea5e9')
    setBtnNewTextColor(config.buttonNewTextColor || '#ffffff')
    setBtnDisableColor(config.buttonDisableColor || '#f97316')
    setBtnDisableTextColor(config.buttonDisableTextColor || '#ffffff')
  }

  function buildAppearanceConfig(): Record<string, string> {
    return {
      fontSize: String(size),
      theme,
      backgroundColor: bgColor,
      tableHeaderColor: headerColor,
      tableHeaderTextColor: headerTextColor,
      tableBorderColor: borderColor,
      tableHeaderFontSize: String(tableHeaderFontSize),
      formHeaderBackgroundColor: formHeaderBg,
      formHeaderTextColor: formHeaderText,
      formHeaderFontSize: String(formHeaderFontSize),
      formLabelTextColor: formLabelText,
      formLabelFontSize: String(formLabelFontSize),
      pageSize: String(pageSize),
      buttonSmallWidth: String(btnSmallWidth),
      buttonLargeWidth: String(btnLargeWidth),
      buttonSaveColor: btnSaveColor,
      buttonDeleteColor: btnDeleteColor,
      buttonCancelColor: btnCancelColor,
      buttonCancelTextColor: btnCancelTextColor,
      buttonSubmitColor: btnSubmitColor,
      buttonSubmitTextColor: btnSubmitTextColor,
      buttonHistoryColor: btnHistoryColor,
      buttonHistoryTextColor: btnHistoryTextColor,
      buttonOkColor: btnOkColor,
      buttonOkTextColor: btnOkTextColor,
      buttonNewColor: btnNewColor,
      buttonNewTextColor: btnNewTextColor,
      buttonDisableColor: btnDisableColor,
      buttonDisableTextColor: btnDisableTextColor,
    }
  }

  /** Marque les paramètres comme modifiés : active le bouton Enregistrer. */
  function markDirty() {
    dirtyRef.current = true
    setDirty(true)
    setSaved(false)
  }

  async function handleSave() {
    const vatValue = Number(vatRate)
    if (canManageCompany && companySocId != null &&
        (vatRate.trim() === '' || !Number.isFinite(vatValue) || vatValue < 0 || vatValue > 100)) {
      setError(t('settings.billing.vatRateError'))
      return
    }
    setSaving(true)
    setError(null)
    markDirty()
    try {
      if (size !== (u.fontSize ?? 14)) {
        await authApi.updateFontSize(size)
      }
      if ((u.theme || 'ocean') !== theme) {
        await authApi.updateTheme(theme)
      }
      if ((u.tableHeaderColor || '#1d48eb') !== headerColor ||
          (u.tableHeaderTextColor || '#ffffff') !== headerTextColor ||
          (u.tableBorderColor || '#000000') !== borderColor) {
        await authApi.updateTableColors(headerColor, borderColor, headerTextColor)
      }
      if ((u.tableHeaderFontSize ?? 15) !== tableHeaderFontSize) {
        await authApi.updateTableHeaderFontSize(tableHeaderFontSize)
      }
      if ((u.formHeaderBackgroundColor || '#0ea5e9') !== formHeaderBg ||
          (u.formHeaderTextColor || '#ffffff') !== formHeaderText ||
          (u.formHeaderFontSize ?? 15) !== formHeaderFontSize ||
          (u.formLabelTextColor || '#0ea5e9') !== formLabelText ||
          (u.formLabelFontSize ?? 12) !== formLabelFontSize) {
        await authApi.updateFormSettings({
          formHeaderBackgroundColor: formHeaderBg,
          formHeaderTextColor: formHeaderText,
          formHeaderFontSize,
          formLabelTextColor: formLabelText,
          formLabelFontSize,
        })
      }
      if ((u.pageSize ?? 5) !== pageSize) {
        await authApi.updatePageSize(pageSize)
      }
      if ((u.buttonSmallWidth ?? 50) !== btnSmallWidth ||
          (u.buttonLargeWidth ?? 100) !== btnLargeWidth ||
          (u.buttonSaveColor || '#1d48eb') !== btnSaveColor ||
          (u.buttonDeleteColor || '#dc2626') !== btnDeleteColor ||
          (u.buttonCancelColor || '#ffffff') !== btnCancelColor ||
          (u.buttonCancelTextColor || '#374151') !== btnCancelTextColor ||
          (u.buttonSubmitColor || '#e0e7ff') !== btnSubmitColor ||
          (u.buttonSubmitTextColor || '#1d48eb') !== btnSubmitTextColor ||
          (u.buttonHistoryColor || '#e0e7ff') !== btnHistoryColor ||
          (u.buttonHistoryTextColor || '#1d48eb') !== btnHistoryTextColor ||
          (u.buttonOkColor || '#16a34a') !== btnOkColor ||
          (u.buttonOkTextColor || '#ffffff') !== btnOkTextColor ||
          (u.buttonNewColor || '#0ea5e9') !== btnNewColor ||
          (u.buttonNewTextColor || '#ffffff') !== btnNewTextColor ||
          (u.buttonDisableColor || '#f97316') !== btnDisableColor ||
          (u.buttonDisableTextColor || '#ffffff') !== btnDisableTextColor) {
        await authApi.updateButtonSettings({
          buttonSmallWidth: btnSmallWidth,
          buttonLargeWidth: btnLargeWidth,
          buttonSaveColor: btnSaveColor,
          buttonDeleteColor: btnDeleteColor,
          buttonCancelColor: btnCancelColor,
          buttonCancelTextColor: btnCancelTextColor,
          buttonSubmitColor: btnSubmitColor,
          buttonSubmitTextColor: btnSubmitTextColor,
          buttonHistoryColor: btnHistoryColor,
          buttonHistoryTextColor: btnHistoryTextColor,
          buttonOkColor: btnOkColor,
          buttonOkTextColor: btnOkTextColor,
          buttonNewColor: btnNewColor,
          buttonNewTextColor: btnNewTextColor,
          buttonDisableColor: btnDisableColor,
          buttonDisableTextColor: btnDisableTextColor,
        })
      }
      if ((u.backgroundColor || '#bae6fd') !== bgColor) {
        await authApi.updateBackgroundColor(bgColor)
      }
      if (canManageCompany && companySocId != null &&
          (leaveDayColor !== savedLeaveDayColor || weekendColor !== savedWeekendColor)) {
        await socsApi.updateCraColors(companySocId, { leaveDayColor, weekendColor })
        setSavedLeaveDayColor(leaveDayColor)
        setSavedWeekendColor(weekendColor)
      }
      if (canManageCompany && companySocId != null && vatRate !== savedVatRate) {
        await socsApi.updateVatRate(companySocId, vatValue)
        setSavedVatRate(vatRate)
        await refreshSocs()
      }
      // Le bouton Enregistrer des paramètres enregistre aussi l'apparence (niveau du rôle).
      if (activeTab === 'appearance') {
        await appearanceApi.save(appearanceScope, buildAppearanceConfig())
        const eff = await appearanceApi.effective()
        applyAppearance(eff)
        applyAppearanceConfig(eff.config)
      }
      await refreshMe()
      setLogoChanged(false)
      dirtyRef.current = false
      setDirty(false)
      setSaved(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tr('common.unexpectedError'))
    } finally {
      setSaving(false)
    }
  }

  /** Restaure l'apparence de SOC360 (valeurs par défaut) après confirmation. */
  async function handleRestoreAppearance() {
    const message = user?.role === 'RESPONSIBLE_SOC'
      ? "Restaurer le paramétrage SOC360 ? Les paramètres SOC360 seront copiés vers votre société."
      : "Restaurer le paramétrage de ma société ? Les paramètres de votre société seront copiés vers votre compte."
    if (!(await dialog.confirm(message, { variant: 'warning', danger: true, okLabel: 'Restaurer' }))) {
      return
    }
    setSaving(true)
    setError(null)
    try {
      const eff = await appearanceApi.restore()
      applyAppearance(eff)
      applyAppearanceConfig(eff.config)
      dirtyRef.current = false
      setDirty(false)
      setSaved(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tr('common.unexpectedError'))
    } finally {
      setSaving(false)
    }
  }

  async function handleTemplateSave() {
    if (!templateKey) return
    setTemplateSaving(true)
    setTemplateError(null)
    setTemplateSaved(false)
    try {
      const updated = await emailTemplatesApi.save(templateKey, {
        subject: templateSubject,
        body: templateBody,
      })
      setEmailTemplates((prev) => prev.map((item) => (item.key === updated.key ? updated : item)))
      setTemplateSaved(true)
    } catch (err) {
      setTemplateError(err instanceof ApiError ? err.message : t('settings.emailTemplates.error'))
    } finally {
      setTemplateSaving(false)
    }
  }

  async function handleTemplateReset() {
    if (!templateKey) return
    setTemplateSaving(true)
    setTemplateError(null)
    setTemplateSaved(false)
    try {
      await emailTemplatesApi.reset(templateKey)
      const list = await emailTemplatesApi.list()
      setEmailTemplates(list)
    } catch (err) {
      setTemplateError(err instanceof ApiError ? err.message : t('settings.emailTemplates.error'))
    } finally {
      setTemplateSaving(false)
    }
  }

  async function handleTrCopy() {
    if (!trSelected) return
    if (trOverride.trim() !== '') {
      const confirmed = await dialog.confirm(t('settings.companyTranslations.confirmOverwrite'), {
        variant: 'question',
      })
      if (!confirmed) return
    }
    setTrOverride(trSelected.value)
  }

  async function handleTrSave() {
    if (!trSelectedKey || !trOverride.trim()) return
    setTrSaving(true)
    setTrError(null)
    setTrMessage(null)
    try {
      await i18nApi.saveCompanyOverride({ lang: language, key: trSelectedKey, value: trOverride })
      setTrEntries((prev) =>
        prev.map((entry) => (entry.key === trSelectedKey ? { ...entry, override: trOverride } : entry)),
      )
      setTrMessage(t('settings.companyTranslations.saved'))
      trUiMemory.search = trSearch
      trUiMemory.selectedKey = trSelectedKey
      trUiMemory.override = trOverride
      await refresh()
      scheduleScrollToRetrad()
    } catch (err) {
      setTrError(err instanceof ApiError ? err.message : t('settings.companyTranslations.error'))
    } finally {
      setTrSaving(false)
    }
  }

  async function handleTrDelete() {
    if (!trSelectedKey) return
    setTrSaving(true)
    setTrError(null)
    setTrMessage(null)
    try {
      await i18nApi.deleteCompanyOverride(language, trSelectedKey)
      setTrEntries((prev) =>
        prev.map((entry) => (entry.key === trSelectedKey ? { ...entry, override: null } : entry)),
      )
      setTrOverride('')
      setTrMessage(t('settings.companyTranslations.deleted'))
      trUiMemory.search = trSearch
      trUiMemory.selectedKey = trSelectedKey
      trUiMemory.override = ''
      await refresh()
      scheduleScrollToRetrad()
    } catch (err) {
      setTrError(err instanceof ApiError ? err.message : t('settings.companyTranslations.error'))
    } finally {
      setTrSaving(false)
    }
  }

  return (
    <div>
      <PageHeader title={t('settings.title')} titleId="settings.title" subtitle={t('settings.subtitle')} subtitleId="settings.subtitle" />
      <Card className="w-[90%] p-6">
        <div className="mb-6 flex flex-wrap gap-2 border-b border-gray-200 pb-2" role="tablist" id="settings.tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`settings.tab.${tab.id}`}
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                activeTab === tab.id
                  ? 'bg-brand-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab.label ?? t(tab.labelKey)}
            </button>
          ))}
        </div>
        <div role="tabpanel" id={`settings.tabpanel.${activeTab}`}>
        <TabPanel active={activeTab === 'general'}>
        <h3 className="text-sm font-semibold text-gray-900" id="settings.language.title">{t('settings.language.title')}</h3>
        <p className="mt-1 text-sm text-gray-500" id="settings.language.description">{t('settings.language.description')}</p>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <Field label={t('settings.language.field')} id="settings.language.field">
            <Select
              id="settings.language.field.select"
              className="w-56"
              value={preference ?? 'browser'}
              onChange={(e) => void handleLanguageChange(e.target.value)}
              disabled={languageSaving}
            >
              <option id="settings.language.browser" value="browser">{t('settings.language.browser')}</option>
              {languages.map((lang) => (
                <option key={lang} value={lang} id={`settings.language.option.${lang}`}>
                  {languageLabel(lang)}
                </option>
              ))}
            </Select>
          </Field>
          {languageSaving && <Spinner />}
        </div>
        {languageError && <p className="mt-3 text-sm text-red-600" id="settings.language.error">{languageError}</p>}
        {languageSaved && (
          <p className="mt-3 text-sm text-green-600" id="settings.language.saved">{t('settings.language.saved')}</p>
        )}
        </TabPanel>

        {canEditTemplates && activeTab === 'translations' && (
          <div>
            <h3 className="mt-8 text-sm font-semibold text-gray-900" id="settings.companyTranslations.title">{t('settings.companyTranslations.title')}</h3>
            <p className="mt-1 text-sm text-gray-500" id="settings.companyTranslations.description">
              {t('settings.companyTranslations.description', { lang: languageLabel(language) })}
            </p>
            {trLoading ? (
              <div className="mt-4">
                <Spinner />
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <Input
                    id="settings.companyTranslations.search"
                    value={trSearch}
                    onChange={(e) => setTrSearch(e.target.value)}
                    placeholder={t('settings.companyTranslations.search')}
                  />
                  <div className="max-h-96 overflow-y-auto rounded-lg border border-gray-200">
                    {trFiltered.length === 0 ? (
                      <p className="px-3 py-4 text-center text-sm text-gray-400" id="settings.companyTranslations.empty">
                        {t('settings.companyTranslations.empty')}
                      </p>
                    ) : (
                      <ul className="divide-y divide-gray-100" id="settings.companyTranslations.list">
                        {trFiltered.map((entry) => (
                          <li key={entry.key} id={`settings.companyTranslations.entry.${entry.key}`}>
                            <button
                              type="button"
                              id={`settings.companyTranslations.entry.${entry.key}.button`}
                              onClick={() => setTrSelectedKey(entry.key)}
                              className={`flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm transition hover:bg-gray-50 ${
                                trSelectedKey === entry.key ? 'bg-brand-50' : ''
                              }`}
                            >
                              <span className="font-mono text-xs text-gray-400" id={`settings.companyTranslations.entry.${entry.key}.key`}>{entry.key}</span>
                              <span className="text-gray-900" id={`settings.companyTranslations.entry.${entry.key}.value`}>{entry.override ?? entry.value}</span>
                              {entry.override && (
                                <span className="text-xs text-brand-600" id={`settings.companyTranslations.entry.${entry.key}.overridden`}>
                                  {t('settings.companyTranslations.overridden')}
                                </span>
                              )}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
                <div className="space-y-3">
                  <Field label={t('settings.companyTranslations.override')} id="settings.companyTranslations.override">
                    <Input
                      id={RETRAD_INPUT_ID}
                      value={trOverride}
                      onChange={(e) => setTrOverride(e.target.value)}
                      disabled={!trSelected}
                    />
                  </Field>
                  <div className="flex flex-wrap items-center gap-2">
                    <IconButton
                      icon="copy"
                      label={t('settings.companyTranslations.copy')}
                      onClick={() => void handleTrCopy()}
                      disabled={!trSelected} id="settings.companyTranslations.copy" />
                    <IconButton
                      icon="save"
                      label={t('settings.companyTranslations.save')}
                      variant="primary"
                      onClick={() => void handleTrSave()}
                      disabled={!trSelected || trSaving || !trOverride.trim()}
                      loading={trSaving} id="settings.companyTranslations.save" />
                    <IconButton
                      icon="delete"
                      label={t('settings.companyTranslations.delete')}
                      variant="danger"
                      onClick={() => void handleTrDelete()}
                      disabled={!trSelected || trSaving || !trSelected.override} id="settings.companyTranslations.delete" />
                  </div>
                  {trMessage && <p className="text-sm text-green-600" id="settings.companyTranslations.message">{trMessage}</p>}
                  {trError && <p className="text-sm text-red-600" id="settings.companyTranslations.error">{trError}</p>}
                </div>
              </div>
            )}
          </div>
        )}

        <TabPanel active={activeTab === 'appearance'}>
        <div id="settings.appearance.tabs" role="tablist" className="mb-4 flex flex-wrap gap-2 border-b border-gray-200 pb-2">
          {[
            { id: 'application', label: 'Application' },
            { id: 'buttons', label: 'Boutons' },
            { id: 'forms', label: 'Formulaires' },
            { id: 'tables', label: 'Tableaux' },
          ].map((sub) => (
            <button
              key={sub.id}
              type="button"
              role="tab"
              id={`settings.appearance.tab.${sub.id}`}
              aria-selected={appearanceTab === sub.id}
              onClick={() => setAppearanceTab(sub.id as typeof appearanceTab)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                appearanceTab === sub.id
                  ? 'bg-brand-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {sub.label}
            </button>
          ))}
        </div>

        {appearanceTab === 'application' && (
        <>
        <h3 className="text-sm font-semibold text-gray-900" id="settings.fontSize.title">{t('settings.fontSize.title')}</h3>
        <p className="mt-1 text-sm text-gray-500" id="settings.fontSize.description">{t('settings.fontSize.description')}</p>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <Field label={t('settings.fontSize.field')} id="settings.fontSize.field">
            <Select
              id="settings.fontSize.field.select"
              className="w-28"
              value={String(size)}
              onChange={(e) => {
                setSize(Number(e.target.value))
                markDirty()
              }}
            >
              {FONT_SIZES.map((s) => (
                <option key={s} value={s} id={`settings.fontSize.option.${s}`}>
                  {s} {tr('Settings.px')}
                </option>
              ))}
            </Select>
          </Field>
          <div
            className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-800"
            style={{ fontSize: `${size}px` }}
            id="settings.fontSize.preview"
          >
            {t('settings.fontSize.preview')}
          </div>
        </div>

        </>
        )}

        {appearanceTab === 'forms' && (
        <>
        <h3 className="mt-8 text-sm font-semibold text-gray-900" id="settings.forms.title">{t('settings.forms.title')}</h3>
        <p className="mt-1 text-sm text-gray-500" id="settings.forms.description">{t('settings.forms.description')}</p>
        <div className="mt-4 flex flex-wrap items-end gap-6">
          <Field label={t('settings.forms.headerBg')} id="settings.forms.headerBg">
            <div className="flex items-center gap-2">
              <input type="color" id="settings.forms.headerBg.input" value={formHeaderBg}
                onChange={(e) => { setFormHeaderBg(e.target.value); markDirty() }}
                className="h-9 w-12 cursor-pointer rounded border border-gray-300 bg-white p-1" />
              <span className="text-sm text-gray-500" id="settings.forms.headerBg.value">{formHeaderBg}</span>
            </div>
          </Field>
          <Field label={t('settings.forms.headerText')} id="settings.forms.headerText">
            <div className="flex items-center gap-2">
              <input type="color" id="settings.forms.headerText.input" value={formHeaderText}
                onChange={(e) => { setFormHeaderText(e.target.value); markDirty() }}
                className="h-9 w-12 cursor-pointer rounded border border-gray-300 bg-white p-1" />
              <span className="text-sm text-gray-500" id="settings.forms.headerText.value">{formHeaderText}</span>
            </div>
          </Field>
          <Field label={t('settings.forms.headerFontSize')} id="settings.forms.headerFontSize">
            <Select id="settings.forms.headerFontSize.select" className="w-28" value={String(formHeaderFontSize)}
              onChange={(e) => { setFormHeaderFontSize(Number(e.target.value)); markDirty() }}>
              {FONT_SIZES.map((s) => (
                <option key={s} value={s} id={`settings.forms.headerFontSize.option.${s}`}>{s} {tr('Settings.px')}</option>
              ))}
            </Select>
          </Field>
          <Field label={t('settings.forms.labelText')} id="settings.forms.labelText">
            <div className="flex items-center gap-2">
              <input type="color" id="settings.forms.labelText.input" value={formLabelText}
                onChange={(e) => { setFormLabelText(e.target.value); markDirty() }}
                className="h-9 w-12 cursor-pointer rounded border border-gray-300 bg-white p-1" />
              <span className="text-sm text-gray-500" id="settings.forms.labelText.value">{formLabelText}</span>
            </div>
          </Field>
          <Field label={t('settings.forms.labelFontSize')} id="settings.forms.labelFontSize">
            <Select id="settings.forms.labelFontSize.select" className="w-28" value={String(formLabelFontSize)}
              onChange={(e) => { setFormLabelFontSize(Number(e.target.value)); markDirty() }}>
              {FONT_SIZES.map((s) => (
                <option key={s} value={s} id={`settings.forms.labelFontSize.option.${s}`}>{s} {tr('Settings.px')}</option>
              ))}
            </Select>
          </Field>
        </div>

        </>
        )}

        {appearanceTab === 'application' && (
        <>
        <h3 className="mt-8 text-sm font-semibold text-gray-900" id="settings.theme.title">{t('settings.theme.title')}</h3>
        <p className="mt-1 text-sm text-gray-500" id="settings.theme.description">{t('settings.theme.description')}</p>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <Field label={t('settings.theme.field')} id="settings.theme.field">
            <Select
              id="settings.theme.field.select"
              className="w-56"
              value={theme}
              onChange={(e) => {
                setTheme(e.target.value)
                markDirty()
              }}
            >
              {THEMES.map((th) => (
                <option key={th.id} value={th.id} id={`settings.theme.option.${th.id}`}>
                  {t(`settings.theme.${th.id}`)}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex items-center gap-2 pb-1">
            <span
              className="inline-block h-5 w-5 rounded-full"
              style={{ backgroundColor: THEMES.find((th) => th.id === theme)?.color }}
            />
            <span className="text-sm text-gray-500" id="settings.theme.preview.value">
              {t(`settings.theme.${theme}`)}
            </span>
          </div>
        </div>
        <div
          className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-800"
          style={{ backgroundColor: 'var(--brand-50)', color: 'var(--brand-800)' }}
          id="settings.theme.preview"
        >
          {t('settings.theme.preview')}
        </div>

        </>
        )}

        {appearanceTab === 'tables' && (
        <>
        <div className="mt-8 grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card id="settings.tables.pageSize.card" className="min-h-[180px] p-4">
            <h3 className="text-sm font-semibold text-gray-900" id="settings.pageSize.title">{t('settings.pageSize.title')}</h3>
            <p className="mt-1 text-sm text-gray-500" id="settings.pageSize.description">{t('settings.pageSize.description')}</p>
            <div className="mt-3">
              <Field label={t('settings.pageSize.field')} id="settings.pageSize.field">
                <Select
                  id="settings.pageSize.field.select"
                  className="w-28"
                  value={String(pageSize)}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value))
                    markDirty()
                  }}
                >
                  {[5, 10, 15, 20, 50, 100].map((n) => (
                    <option key={n} value={n} id={`settings.pageSize.option.${n}`}>
                      {n}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </Card>

          <Card id="settings.tables.colors.card" className="min-h-[180px] p-4">
            <h3 className="text-sm font-semibold text-gray-900" id="settings.colors.title">{t('settings.colors.title')}</h3>
            <p className="mt-1 text-sm text-gray-500" id="settings.colors.description">{t('settings.colors.description')}</p>
            <div className="mt-3 flex flex-wrap items-end gap-4">
              <Field label={t('settings.colors.header')} id="settings.colors.header">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    id="settings.colors.header.input"
                    value={headerColor}
                    onChange={(e) => {
                      setHeaderColor(e.target.value)
                      markDirty()
                    }}
                    className="h-9 w-12 cursor-pointer rounded border border-gray-300 bg-white p-1"
                  />
                  <span className="text-sm text-gray-500" id="settings.colors.header.value">{headerColor}</span>
                </div>
              </Field>
              <Field label={t('settings.colors.headerText')} id="settings.colors.headerText">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    id="settings.colors.headerText.input"
                    value={headerTextColor}
                    onChange={(e) => {
                      setHeaderTextColor(e.target.value)
                      markDirty()
                    }}
                    className="h-9 w-12 cursor-pointer rounded border border-gray-300 bg-white p-1"
                  />
                  <span className="text-sm text-gray-500" id="settings.colors.headerText.value">{headerTextColor}</span>
                </div>
              </Field>
              <Field label={t('settings.colors.border')} id="settings.colors.border">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    id="settings.colors.border.input"
                    value={borderColor}
                    onChange={(e) => {
                      setBorderColor(e.target.value)
                      markDirty()
                    }}
                    className="h-9 w-12 cursor-pointer rounded border border-gray-300 bg-white p-1"
                  />
                  <span className="text-sm text-gray-500" id="settings.colors.border.value">{borderColor}</span>
                </div>
              </Field>
            </div>
          </Card>

          <Card id="settings.tables.header.card" className="min-h-[180px] p-4">
            <h3 className="text-sm font-semibold text-gray-900" id="settings.tableHeaderFontSize.title">{t('settings.tableHeaderFontSize.title')}</h3>
            <p className="mt-1 text-sm text-gray-500" id="settings.tableHeaderFontSize.description">{t('settings.tableHeaderFontSize.description')}</p>
            <div className="mt-3">
              <Field label={t('settings.tableHeaderFontSize.field')} id="settings.tableHeaderFontSize.field">
                <Select
                  id="settings.tableHeaderFontSize.select"
                  className="w-28"
                  value={String(tableHeaderFontSize)}
                  onChange={(e) => {
                    setTableHeaderFontSize(Number(e.target.value))
                    markDirty()
                  }}
                >
                  {FONT_SIZES.map((s) => (
                    <option key={s} value={s} id={`settings.tableHeaderFontSize.option.${s}`}>
                      {s} {tr('Settings.px')}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </Card>
        </div>

        <Card id="settings.tables.preview.card" className="mt-4 p-4">
          <h3 className="mb-2 text-sm font-semibold text-gray-900" id="settings.tables.preview.title">{t('settings.preview')}</h3>
          <div className="overflow-hidden rounded-xl border" style={{ borderColor: borderColor }}>
            <table className="min-w-full divide-y" style={{ borderColor: borderColor }} id="settings.colors.preview.table">
              <thead style={{ backgroundColor: headerColor }}>
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-bold uppercase tracking-wide" style={{ color: headerTextColor }} id="settings.example">
                    {t('settings.example')}
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-bold uppercase tracking-wide" style={{ color: headerTextColor }} id="settings.preview">
                    {t('settings.preview')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y bg-white">
                <tr>
                  <td className="px-4 py-2 text-sm text-gray-700" id="settings.row.1">{t('settings.row')} 1</td>
                  <td className="px-4 py-2 text-sm text-gray-700" id="settings.content.1">{t('settings.content')}</td>
                </tr>
                <tr className="even:bg-gray-50">
                  <td className="px-4 py-2 text-sm text-gray-700" id="settings.row.2">{t('settings.row')} 2</td>
                  <td className="px-4 py-2 text-sm text-gray-700" id="settings.content.2">{t('settings.content')}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
        </>
        )}
        </TabPanel>

        <TabPanel active={activeTab === 'company'}>
        {canManageCompany && isAdmin && (
          <div className="mt-2">
            <Field label={t('settings.company.select')} id="settings.company.select">
              <Select
                id="settings.company.select.input"
                className="w-72"
                value={companySocId ?? ''}
                onChange={(e) => setAdminSocId(Number(e.target.value))}
              >
                {adminSocs.map((soc) => (
                  <option key={soc.id} value={soc.id} id={`settings.company.select.option.${soc.id}`}>
                    {soc.name}
                  </option>
                ))}
              </Select>
            </Field>
            {adminSocs.length === 0 && (
              <p id="settings.company.empty" className="mt-3 text-sm text-gray-500">
                {t('settings.company.empty')}
              </p>
            )}
          </div>
        )}
        {canManageCompany && companySocId != null && (
          <div className="mt-8">
            <SocLogoField
              socId={companySocId}
              hasLogo={socHasLogo}
              socName={companySoc?.name}
              onChange={(saved) => {
                setSocHasLogo(saved.hasLogo ?? false)
                setLogoChanged(true)
                markDirty()
                void refreshSocs()
              }}
            />
          </div>
        )}

        {canManageCompany && companySocId != null && (
          <>
            <h3 className="mt-8 text-sm font-semibold text-gray-900" id="settings.craColors.title">
              {t('settings.craColors.title')}
            </h3>
            <p className="mt-1 text-sm text-gray-500" id="settings.craColors.description">{t('settings.craColors.description')}</p>
            <div className="mt-4 flex flex-wrap items-end gap-6">
              <Field label={t('settings.craColors.leave')} id="settings.craColors.leave">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    id="settings.craColors.leave.input"
                    value={leaveDayColor}
                    onChange={(e) => {
                      setLeaveDayColor(e.target.value)
                      markDirty()
                    }}
                    className="h-9 w-12 cursor-pointer rounded border border-gray-300 bg-white p-1"
                  />
                  <span className="text-sm text-gray-500" id="settings.craColors.leave.value">{leaveDayColor}</span>
                </div>
              </Field>
              <Field label={t('settings.craColors.weekend')} id="settings.craColors.weekend">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    id="settings.craColors.weekend.input"
                    value={weekendColor}
                    onChange={(e) => {
                      setWeekendColor(e.target.value)
                      markDirty()
                    }}
                    className="h-9 w-12 cursor-pointer rounded border border-gray-300 bg-white p-1"
                  />
                  <span className="text-sm text-gray-500" id="settings.craColors.weekend.value">{weekendColor}</span>
                </div>
              </Field>
            </div>
          </>
        )}

        {canManageCompany && companySocId != null && (
          <>
            <h3 className="mt-8 text-sm font-semibold text-gray-900" id="settings.billing.title">
              {t('settings.billing.title')}
            </h3>
            <p className="mt-1 text-sm text-gray-500" id="settings.billing.description">
              {t('settings.billing.description')}
            </p>
            <div className="mt-4 flex flex-wrap items-end gap-6">
              <Field label={t('settings.billing.vatRate')} id="settings.billing.vatRate">
                <Input
                  id="settings.billing.vatRate.input"
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  className="w-28"
                  value={vatRate}
                  onChange={(e) => {
                    setVatRate(e.target.value)
                    markDirty()
                  }}
                />
              </Field>
              <p className="pb-2 text-sm text-gray-500" id="settings.billing.vatRateHint">
                {t('settings.billing.vatRateHint')}
              </p>
            </div>
          </>
        )}
        </TabPanel>

        <TabPanel active={activeTab === 'appearance' && appearanceTab === 'buttons'}>
        <h3 className="text-sm font-semibold text-gray-900" id="settings.buttons.title">{t('settings.buttons.title')}</h3>
        <p className="mt-1 text-sm text-gray-500" id="settings.buttons.description">{t('settings.buttons.description')}</p>
        <div className="mt-4 flex flex-wrap items-end gap-6">
          <Field label={t('settings.buttons.smallWidth')} id="settings.buttons.smallWidth">
            <Input
              id="settings.buttons.smallWidth.input"
              type="number"
              min={20}
              max={400}
              className="w-28"
              value={btnSmallWidth}
              onChange={(e) => {
                setBtnSmallWidth(Number(e.target.value) || 0)
                markDirty()
              }}
            />
          </Field>
          <Field label={t('settings.buttons.largeWidth')} id="settings.buttons.largeWidth">
            <Input
              id="settings.buttons.largeWidth.input"
              type="number"
              min={20}
              max={400}
              className="w-28"
              value={btnLargeWidth}
              onChange={(e) => {
                setBtnLargeWidth(Number(e.target.value) || 0)
                markDirty()
              }}
            />
          </Field>
          <Field label={t('settings.buttons.saveColor')} id="settings.buttons.saveColor">
            <div className="flex items-center gap-2">
              <input
                type="color"
                id="settings.buttons.saveColor.input"
                value={btnSaveColor}
                onChange={(e) => {
                  setBtnSaveColor(e.target.value)
                  markDirty()
                }}
                className="h-9 w-12 cursor-pointer rounded border border-gray-300 bg-white p-1"
              />
              <span className="text-sm text-gray-500" id="settings.buttons.saveColor.value">{btnSaveColor}</span>
            </div>
          </Field>
          <Field label={t('settings.buttons.deleteColor')} id="settings.buttons.deleteColor">
            <div className="flex items-center gap-2">
              <input
                type="color"
                id="settings.buttons.deleteColor.input"
                value={btnDeleteColor}
                onChange={(e) => {
                  setBtnDeleteColor(e.target.value)
                  markDirty()
                }}
                className="h-9 w-12 cursor-pointer rounded border border-gray-300 bg-white p-1"
              />
              <span className="text-sm text-gray-500" id="settings.buttons.deleteColor.value">{btnDeleteColor}</span>
            </div>
          </Field>
          <Field label={t('settings.buttons.disableColor')} id="settings.buttons.disableColor">
            <div className="flex items-center gap-2">
              <input
                type="color"
                id="settings.buttons.disableColor.input"
                value={btnDisableColor}
                onChange={(e) => {
                  setBtnDisableColor(e.target.value)
                  markDirty()
                }}
                className="h-9 w-12 cursor-pointer rounded border border-gray-300 bg-white p-1"
              />
              <span className="text-sm text-gray-500" id="settings.buttons.disableColor.value">{btnDisableColor}</span>
            </div>
          </Field>
          <Field label={t('settings.buttons.disableTextColor')} id="settings.buttons.disableTextColor">
            <div className="flex items-center gap-2">
              <input
                type="color"
                id="settings.buttons.disableTextColor.input"
                value={btnDisableTextColor}
                onChange={(e) => {
                  setBtnDisableTextColor(e.target.value)
                  markDirty()
                }}
                className="h-9 w-12 cursor-pointer rounded border border-gray-300 bg-white p-1"
              />
              <span className="text-sm text-gray-500" id="settings.buttons.disableTextColor.value">{btnDisableTextColor}</span>
            </div>
          </Field>
          <Field label={t('settings.buttons.cancelColor')} id="settings.buttons.cancelColor">
            <div className="flex items-center gap-2">
              <input
                type="color"
                id="settings.buttons.cancelColor.input"
                value={btnCancelColor}
                onChange={(e) => {
                  setBtnCancelColor(e.target.value)
                  markDirty()
                }}
                className="h-9 w-12 cursor-pointer rounded border border-gray-300 bg-white p-1"
              />
              <span className="text-sm text-gray-500" id="settings.buttons.cancelColor.value">{btnCancelColor}</span>
            </div>
          </Field>
          <Field label={t('settings.buttons.cancelTextColor')} id="settings.buttons.cancelTextColor">
            <div className="flex items-center gap-2">
              <input
                type="color"
                id="settings.buttons.cancelTextColor.input"
                value={btnCancelTextColor}
                onChange={(e) => {
                  setBtnCancelTextColor(e.target.value)
                  markDirty()
                }}
                className="h-9 w-12 cursor-pointer rounded border border-gray-300 bg-white p-1"
              />
              <span className="text-sm text-gray-500" id="settings.buttons.cancelTextColor.value">{btnCancelTextColor}</span>
            </div>
          </Field>
          <Field label={t('settings.buttons.submitColor')} id="settings.buttons.submitColor">
            <div className="flex items-center gap-2">
              <input
                type="color"
                id="settings.buttons.submitColor.input"
                value={btnSubmitColor}
                onChange={(e) => {
                  setBtnSubmitColor(e.target.value)
                  markDirty()
                }}
                className="h-9 w-12 cursor-pointer rounded border border-gray-300 bg-white p-1"
              />
              <span className="text-sm text-gray-500" id="settings.buttons.submitColor.value">{btnSubmitColor}</span>
            </div>
          </Field>
          <Field label={t('settings.buttons.submitTextColor')} id="settings.buttons.submitTextColor">
            <div className="flex items-center gap-2">
              <input
                type="color"
                id="settings.buttons.submitTextColor.input"
                value={btnSubmitTextColor}
                onChange={(e) => {
                  setBtnSubmitTextColor(e.target.value)
                  markDirty()
                }}
                className="h-9 w-12 cursor-pointer rounded border border-gray-300 bg-white p-1"
              />
              <span className="text-sm text-gray-500" id="settings.buttons.submitTextColor.value">{btnSubmitTextColor}</span>
            </div>
          </Field>
          <Field label={t('settings.buttons.historyColor')} id="settings.buttons.historyColor">
            <div className="flex items-center gap-2">
              <input
                type="color"
                id="settings.buttons.historyColor.input"
                value={btnHistoryColor}
                onChange={(e) => {
                  setBtnHistoryColor(e.target.value)
                  markDirty()
                }}
                className="h-9 w-12 cursor-pointer rounded border border-gray-300 bg-white p-1"
              />
              <span className="text-sm text-gray-500" id="settings.buttons.historyColor.value">{btnHistoryColor}</span>
            </div>
          </Field>
          <Field label={t('settings.buttons.historyTextColor')} id="settings.buttons.historyTextColor">
            <div className="flex items-center gap-2">
              <input
                type="color"
                id="settings.buttons.historyTextColor.input"
                value={btnHistoryTextColor}
                onChange={(e) => {
                  setBtnHistoryTextColor(e.target.value)
                  markDirty()
                }}
                className="h-9 w-12 cursor-pointer rounded border border-gray-300 bg-white p-1"
              />
              <span className="text-sm text-gray-500" id="settings.buttons.historyTextColor.value">{btnHistoryTextColor}</span>
            </div>
          </Field>
          <Field label={t('settings.buttons.newColor')} id="settings.buttons.newColor">
            <div className="flex items-center gap-2">
              <input
                type="color"
                id="settings.buttons.newColor.input"
                value={btnNewColor}
                onChange={(e) => {
                  setBtnNewColor(e.target.value)
                  markDirty()
                }}
                className="h-9 w-12 cursor-pointer rounded border border-gray-300 bg-white p-1"
              />
              <span className="text-sm text-gray-500" id="settings.buttons.newColor.value">{btnNewColor}</span>
            </div>
          </Field>
          <Field label={t('settings.buttons.newTextColor')} id="settings.buttons.newTextColor">
            <div className="flex items-center gap-2">
              <input
                type="color"
                id="settings.buttons.newTextColor.input"
                value={btnNewTextColor}
                onChange={(e) => {
                  setBtnNewTextColor(e.target.value)
                  markDirty()
                }}
                className="h-9 w-12 cursor-pointer rounded border border-gray-300 bg-white p-1"
              />
              <span className="text-sm text-gray-500" id="settings.buttons.newTextColor.value">{btnNewTextColor}</span>
            </div>
          </Field>
          <Field label={t('settings.buttons.okColor')} id="settings.buttons.okColor">
            <div className="flex items-center gap-2">
              <input
                type="color"
                id="settings.buttons.okColor.input"
                value={btnOkColor}
                onChange={(e) => {
                  setBtnOkColor(e.target.value)
                  markDirty()
                }}
                className="h-9 w-12 cursor-pointer rounded border border-gray-300 bg-white p-1"
              />
              <span className="text-sm text-gray-500" id="settings.buttons.okColor.value">{btnOkColor}</span>
            </div>
          </Field>
          <Field label={t('settings.buttons.okTextColor')} id="settings.buttons.okTextColor">
            <div className="flex items-center gap-2">
              <input
                type="color"
                id="settings.buttons.okTextColor.input"
                value={btnOkTextColor}
                onChange={(e) => {
                  setBtnOkTextColor(e.target.value)
                  markDirty()
                }}
                className="h-9 w-12 cursor-pointer rounded border border-gray-300 bg-white p-1"
              />
              <span className="text-sm text-gray-500" id="settings.buttons.okTextColor.value">{btnOkTextColor}</span>
            </div>
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
          <span className="text-sm text-gray-500" id="settings.buttons.preview">{t('settings.buttons.preview')} :</span>
          <button
            type="button"
            id="settings.buttons.preview.ok"
            className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition hover:brightness-95"
            style={{ minWidth: `${btnSmallWidth}px`, backgroundColor: btnOkColor, color: btnOkTextColor }}
          >
            OK
          </button>
          <button
            type="button"
            id="NoteFraisList.nouvelle.note.de.frais"
            className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition hover:brightness-95"
            style={{ minWidth: `${btnLargeWidth}px`, backgroundColor: btnNewColor, color: btnNewTextColor }}
          >
            {tr('NoteFraisList.nouvelle.note.de.frais')}
          </button>
          <button
            type="button"
            id="common.delete"
            className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95"
            style={{ minWidth: `${btnLargeWidth}px`, backgroundColor: btnDeleteColor }}
          >
            {tr('common.delete')}
          </button>
          <button
            type="button"
            id="UnavailabilityTypes.disable"
            className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition hover:brightness-95"
            style={{
              minWidth: `${btnLargeWidth}px`,
              backgroundColor: btnDisableColor,
              color: btnDisableTextColor,
            }}
          >
            {tr('UnavailabilityTypes.disable')}
          </button>
          <button
            type="button"
            id="common.cancel"
            className="inline-flex items-center justify-center rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold transition hover:brightness-95"
            style={{
              minWidth: `${btnLargeWidth}px`,
              backgroundColor: btnCancelColor,
              color: btnCancelTextColor,
            }}
          >
            {tr('common.cancel')}
          </button>
          <button
            type="button"
            id="Unavailability.soumettre"
            className="inline-flex items-center justify-center rounded-xl border px-4 py-2 text-sm font-semibold transition hover:brightness-95"
            style={{
              minWidth: `${btnLargeWidth}px`,
              backgroundColor: btnSubmitColor,
              color: btnSubmitTextColor,
              borderColor: btnSubmitColor,
            }}
          >
            {tr('Unavailability.soumettre')}
          </button>
          <button
            type="button"
            id="common.history"
            className="inline-flex items-center justify-center rounded-xl border px-4 py-2 text-sm font-semibold transition hover:brightness-95"
            style={{
              minWidth: `${btnLargeWidth}px`,
              backgroundColor: btnHistoryColor,
              color: btnHistoryTextColor,
              borderColor: btnHistoryColor,
            }}
          >
            {tr('common.history')}
          </button>
        </div>
        </TabPanel>

        <TabPanel active={activeTab === 'appearance' && appearanceTab === 'application'}>
        <h3 className="mt-8 text-sm font-semibold text-gray-900" id="settings.background.title">{t('settings.background.title')}</h3>
        <p className="mt-1 text-sm text-gray-500" id="settings.background.description">{t('settings.background.description')}</p>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <Field label={t('settings.background.color')} id="settings.background.color">
            <div className="flex items-center gap-2">
              <input
                type="color"
                id="settings.background.color.input"
                value={bgColor}
                onChange={(e) => {
                  setBgColor(e.target.value)
                  markDirty()
                }}
                className="h-9 w-12 cursor-pointer rounded border border-gray-300 bg-white p-1"
              />
              <span className="text-sm text-gray-500" id="settings.background.color.value">{bgColor}</span>
            </div>
          </Field>
          <div
            className="min-w-48 rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-700"
            style={{
              background: `linear-gradient(135deg, ${bgColor} 0%, color-mix(in srgb, ${bgColor} 45%, white) 55%, #ffffff 100%)`,
            }}
            id="settings.background.preview"
          >
            {t('settings.background.preview')}
          </div>
        </div>
        </TabPanel>

        {canEditTemplates && activeTab === 'emails' && (
          <div>
            <h3 className="text-sm font-semibold text-gray-900" id="settings.emailTemplates.title">{t('settings.emailTemplates.title')}</h3>
            <p className="mt-1 text-sm text-gray-500" id="settings.emailTemplates.description">{t('settings.emailTemplates.description')}</p>
            {templateLoading ? (
              <div className="mt-4">
                <Spinner />
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <Field label={t('settings.emailTemplates.template')} id="settings.emailTemplates.template">
                  <Select id="settings.emailTemplates.template.select" value={templateKey} onChange={(e) => setTemplateKey(e.target.value)}>
                    {emailTemplates.map((item) => (
                      <option key={item.key} value={item.key} id={`settings.emailTemplates.template.option.${item.key}`}>
                        {tr(`settings.emailTemplate.${item.key}`)}
                      </option>
                    ))}
                  </Select>
                </Field>
                {selectedTemplate && (
                  <>
                    <p className="text-xs text-gray-500" id="settings.emailTemplates.variables">
                      {t('settings.emailTemplates.variables')} :{' '}
                      <span className="font-mono" id="settings.emailTemplates.variables.value">{selectedTemplate.variables.map((v) => `{{${v}}}`).join(', ')}</span>
                      {selectedTemplate.custom ? ` · ${t('settings.emailTemplates.custom')}` : ''}
                    </p>
                    <Field label={t('settings.emailTemplates.subject')} id="settings.emailTemplates.subject">
                      <Input id="settings.emailTemplates.subject.input" value={templateSubject} onChange={(e) => setTemplateSubject(e.target.value)} />
                    </Field>
                    <Field label={t('settings.emailTemplates.body')} id="settings.emailTemplates.body">
                      <Textarea
                        id="settings.emailTemplates.body.textarea"
                        rows={10}
                        className="font-mono text-xs"
                        value={templateBody}
                        onChange={(e) => setTemplateBody(e.target.value)}
                      />
                    </Field>
                    <div className="flex flex-wrap items-center gap-3">
                      <IconButton
                        icon="save"
                        label={t('common.save')}
                        variant="primary"
                        onClick={() => void handleTemplateSave()}
                        disabled={templateSaving}
                        loading={templateSaving} id="common.save" />
                      <IconButton
                        icon="refresh"
                        label={t('settings.emailTemplates.reset')}
                        onClick={() => void handleTemplateReset()}
                        disabled={templateSaving} id="settings.emailTemplates.reset" />
                      {templateSaved && (
                        <span className="text-sm text-green-600" id="settings.emailTemplates.saved">{t('settings.emailTemplates.saved')}</span>
                      )}
                      {templateError && <span className="text-sm text-red-600" id="settings.emailTemplates.error">{templateError}</span>}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
        </div>
      </Card>

      <div id="settings.actions" className="mt-4 w-[90%] pl-1">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            id="common.save.button"
            className="w-auto"
            onClick={() => void handleSave()}
            disabled={saving || !dirty}
          >
            {saving ? <Spinner className="border-white border-t-transparent" /> : null}
            {t('common.save')}
          </Button>
          {activeTab === 'appearance' && user?.role !== 'ADMIN' && (
            <Button
              id="settings.appearance.restore"
              className="w-auto"
              variant="neutral"
              onClick={() => void handleRestoreAppearance()}
              disabled={saving}
            >
              {appearanceRestoreLabel}
            </Button>
          )}
        </div>
        {error && <p className="mt-3 text-sm text-red-600" id="settings.error">{error}</p>}
        {saved && <p className="mt-3 text-sm text-green-600" id="settings.saved">{t('settings.saved')}</p>}
      </div>
    </div>
  )
}
