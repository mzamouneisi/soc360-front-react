import { useCallback, useSyncExternalStore } from 'react'
import { dynamicTranslate, getDynamicVersion, subscribeDynamic } from './dynamicTranslate'
import { useI18n } from '../i18n'

export function useDynamicTranslate(): (text: string | null | undefined) => string {
  useSyncExternalStore(subscribeDynamic, getDynamicVersion, () => 0)
  const { language } = useI18n()
  return useCallback(
    (text: string | null | undefined) => {
      void language
      return dynamicTranslate(text)
    },
    [language],
  )
}
