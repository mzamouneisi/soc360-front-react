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
  const { selectedSoc } = useSoc()
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
  }, [selectedSoc?.id, selectedSoc?.hasLogo])

  return (
    <>
      <img
        id="MainLayout.logo"
        src={src}
        alt={selectedSoc?.name ?? tr('MainLayout.soc360')}
        className={
          selectedSoc?.hasLogo
            ? 'h-20 w-full object-contain'
            : 'h-10 w-10 object-contain'
        }
      />
      {!selectedSoc?.hasLogo && (
        <span id="MainLayout.soc360">{tr('MainLayout.soc360')}</span>
      )}
    </>
  )
}
