import { tr } from '../i18n/translate'
import { useEffect, useState } from 'react'
import { socsApi } from '../api/socs'
import { DEFAULT_SOC_LOGO } from '../lib/socLogo'
import { useSoc } from '../soc/SocContext'

/**
 * Logo de la société courante, avec repli automatique sur le logo SOC360 par défaut.
 * Dès qu'un logo personnalisé existe, le texte « SOC360 » est masqué pour ne laisser
 * apparaître que le logo de la société.
 */
export function SocBrandLogo() {
  const { selectedSoc, socRevision } = useSoc()
  const [src, setSrc] = useState(DEFAULT_SOC_LOGO)

  useEffect(() => {
    let active = true
    let objectUrl: string | null = null
    if (selectedSoc?.hasLogo) {
      socsApi
        .logoUrl(selectedSoc.id)
        .then((url) => {
          if (active) {
            objectUrl = url
            setSrc(url)
          } else {
            URL.revokeObjectURL(url)
          }
        })
        .catch(() => {
          if (active) setSrc(DEFAULT_SOC_LOGO)
        })
    } else {
      setSrc(DEFAULT_SOC_LOGO)
    }
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [selectedSoc?.id, selectedSoc?.hasLogo, socRevision])

  const rawWebsite = selectedSoc?.website?.trim() ?? ''
  const websiteUrl = rawWebsite
    ? /^https?:\/\//i.test(rawWebsite)
      ? rawWebsite
      : `https://${rawWebsite}`
    : null

  const logo = (
    <img
      id="MainLayout.logo"
      src={src}
      alt={selectedSoc?.name ?? tr('MainLayout.soc360')}
      className={
        selectedSoc?.hasLogo
          ? 'h-28 w-full object-contain'
          : 'h-10 w-10 object-contain'
      }
    />
  )

  return (
    <>
      {websiteUrl ? (
        <a
          id="MainLayout.logo.link"
          href={websiteUrl}
          target="_blank"
          rel="noreferrer"
          title={websiteUrl}
          className="flex max-w-full items-center justify-center"
        >
          {logo}
        </a>
      ) : (
        logo
      )}
      {!selectedSoc?.hasLogo && (
        <span id="MainLayout.soc360">{tr('MainLayout.soc360')}</span>
      )}
    </>
  )
}
