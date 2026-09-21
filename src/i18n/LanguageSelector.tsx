import { languageLabel } from './messages'
import { useI18n } from './index'

export function LanguageSelector({ className = '' }: { className?: string }) {
  const { language, languages, setLanguage, t } = useI18n()
  return (
    <select
      aria-label={t('app.selectLanguage')}
      title={t('app.language')}
      value={language}
      onChange={(e) => void setLanguage(e.target.value)}
      className={`rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 ${className}`}
    >
      {languages.map((lang) => (
        <option key={lang} value={lang}>
          {languageLabel(lang)}
        </option>
      ))}
    </select>
  )
}
