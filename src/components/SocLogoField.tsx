import { tr } from '../i18n/translate'
import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { ApiError } from '../api/client'
import { socsApi } from '../api/socs'
import type { SocDto } from '../api/types'
import { Button } from '../components/ui'
import { dialog } from '../components/dialog'
import {
  DEFAULT_SOC_LOGO,
  validateSocLogoFile,
  type SocLogoValidationError,
} from '../lib/socLogo'

interface SocLogoFieldProps {
  socId: number
  hasLogo: boolean
  socName?: string | null
  disabled?: boolean
  onChange: (soc: SocDto) => void
}

/**
 * Gestion du logo d'une société existante : aperçu, ajout/remplacement immédiat et suppression
 * avec confirmation. En cas d'échec, l'ancien logo reste affiché.
 */
export function SocLogoField({ socId, hasLogo, socName, disabled = false, onChange }: SocLogoFieldProps) {
  const [preview, setPreview] = useState(hasLogo ? '' : DEFAULT_SOC_LOGO)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [validation, setValidation] = useState<SocLogoValidationError>(null)
  const objectUrlRef = useRef<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  function setPreviewUrl(url: string | null) {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
    if (url) {
      objectUrlRef.current = url
      setPreview(url)
    } else {
      setPreview(hasLogo ? '' : DEFAULT_SOC_LOGO)
    }
  }

  useEffect(() => {
    let active = true
    if (!hasLogo) {
      setPreviewUrl(null)
    } else {
      socsApi
        .logoUrl(socId)
        .then((url) => {
          if (active) setPreviewUrl(url)
          else URL.revokeObjectURL(url)
        })
        .catch(() => {
          if (active) setPreviewUrl(null)
        })
    }
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socId, hasLogo])

  useEffect(() => () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
  }, [])

  function validationMessage(value: SocLogoValidationError): string | null {
    if (value === 'format') return tr('SocLogo.format.invalide')
    if (value === 'taille') return tr('SocLogo.taille.invalide')
    return null
  }

  async function chooseLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    if (!file) return
    setError(null)
    const result = validateSocLogoFile(file)
    setValidation(result)
    if (result) {
      if (inputRef.current) inputRef.current.value = ''
      return
    }
    setUploading(true)
    try {
      const saved = await socsApi.uploadLogo(socId, file)
      onChange(saved)
      setPreviewUrl(URL.createObjectURL(file))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tr('common.unexpectedError'))
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function removeLogo() {
    if (
      !(await dialog.confirm(tr('SocLogo.supprimer.confirm'), {
        variant: 'warning',
        danger: true,
        okLabel: tr('SocLogo.supprimer'),
      }))
    ) {
      return
    }
    setError(null)
    setValidation(null)
    setUploading(true)
    try {
      const saved = await socsApi.removeLogo(socId)
      onChange(saved)
      setPreviewUrl(null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tr('common.unexpectedError'))
    } finally {
      setUploading(false)
    }
  }

  const display = preview || DEFAULT_SOC_LOGO

  return (
    <fieldset id="SocLogo.fieldset" className="space-y-3 rounded-lg border border-gray-200 p-4">
      <legend id="SocLogo.logo" className="px-1 text-sm font-medium text-gray-700">
        {tr('SocLogo.logo')}
      </legend>
      <div className="flex flex-wrap items-center gap-4">
        <img
          id="SocLogo.apercu.image"
          src={display}
          alt={socName ? `${tr('SocLogo.logo')} ${socName}` : tr('SocLogo.logo')}
          className="h-16 w-28 rounded border border-gray-200 bg-white object-contain p-1"
        />
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            id="SocLogo.choisir.input"
            type="file"
            accept=".png,.jpg,.jpeg,image/png,image/jpeg"
            disabled={disabled || uploading}
            onChange={chooseLogo}
            className="text-sm text-gray-600 file:mr-2 file:rounded-lg file:border-0 file:bg-brand-600 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-brand-700 disabled:opacity-50"
          />
          {hasLogo && (
            <Button
              id="SocLogo.supprimer"
              type="button"
              onClick={() => void removeLogo()}
              disabled={disabled || uploading}
              className="!w-auto !bg-red-50 !text-red-700 hover:!bg-red-100"
            >
              {tr('SocLogo.supprimer')}
            </Button>
          )}
        </div>
      </div>
      <p id="SocLogo.formats" className="text-xs text-gray-500">
        {tr('SocLogo.formats')}
        {!hasLogo && ` — ${tr('SocLogo.logo.par.defaut')}`}
      </p>
      {uploading && (
        <p id="SocLogo.televersement" className="text-xs text-gray-500">
          {tr('SocLogo.televersement')}
        </p>
      )}
      {validation && (
        <p id="SocLogo.erreur.validation" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {validationMessage(validation)}
        </p>
      )}
      {error && (
        <p id="SocLogo.erreur" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </fieldset>
  )
}
