import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { consultantsApi } from '../api/consultants'
import type { ConsultantDto } from '../api/types'
import { Button } from './ui'
import { dialog } from './dialog'
import { tr } from '../i18n/translate'
import {
  validateConsultantPhotoFile,
  consultantInitials,
  type ConsultantPhotoValidationError,
} from '../lib/consultantPhoto'

interface ConsultantPhotoFieldProps {
  consultantId: number
  hasPhoto: boolean
  firstName?: string | null
  lastName?: string | null
  disabled?: boolean
  onChange?: (saved: ConsultantDto) => void
}

export function ConsultantPhotoField({
  consultantId,
  hasPhoto,
  firstName,
  lastName,
  disabled = false,
  onChange,
}: ConsultantPhotoFieldProps) {
  const [preview, setPreview] = useState(hasPhoto ? '' : '')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [validation, setValidation] = useState<ConsultantPhotoValidationError>(null)
  const objectUrlRef = useRef<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    let active = true
    let objectUrl: string | null = null
    if (!hasPhoto) {
      setPreview('')
      return () => {
        active = false
      }
    }
    consultantsApi
      .photoUrl(consultantId)
      .then((value) => {
        if (!active) {
          URL.revokeObjectURL(value)
          return
        }
        objectUrl = value
        setPreview(value)
      })
      .catch(() => {
        if (active) setPreview('')
      })
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [consultantId, hasPhoto])

  useEffect(
    () => () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    },
    [],
  )

  function setPreviewUrl(url: string | null) {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
    if (url) {
      objectUrlRef.current = url
      setPreview(url)
    } else {
      setPreview(hasPhoto ? '' : '')
    }
  }

  async function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    if (!file) return
    setError(null)
    const result = validateConsultantPhotoFile(file)
    setValidation(result)
    if (result) {
      if (inputRef.current) inputRef.current.value = ''
      return
    }
    setUploading(true)
    try {
      const saved = await consultantsApi.uploadPhoto(consultantId, file)
      onChange?.(saved)
      const url = URL.createObjectURL(file)
      objectUrlRef.current = url
      setPreview(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function removePhoto() {
    const confirmed = await dialog.confirm(tr('Consultants.photo.supprimer'), {
      variant: 'warning',
      danger: true,
      okLabel: tr('common.delete'),
    })
    if (!confirmed) return
    setError(null)
    setValidation(null)
    setUploading(true)
    try {
      const saved = await consultantsApi.removePhoto(consultantId)
      onChange?.(saved)
      setPreviewUrl(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setUploading(false)
    }
  }

  const display = preview ?? ''

  return (
    <fieldset id="Consultants.photo.field" className="space-y-3 rounded-lg border border-gray-200 p-4">
      <legend id="Consultants.photo" className="px-1 text-sm font-medium text-gray-700">
        {tr('Consultants.photo')}
      </legend>
      <div className="flex flex-wrap items-center gap-4">
        {display ? (
          <img
            id="Consultants.photo.apercu.image"
            src={display}
            alt={tr('Consultants.photo')}
            className="h-24 w-24 rounded-full border border-gray-200 bg-white object-cover"
          />
        ) : (
          <div
            id="Consultants.photo.apercu.placeholder"
            className="flex h-24 w-24 items-center justify-center rounded-full bg-brand-100 text-brand-800"
          >
            <span className="text-sm font-medium">{consultantInitials(firstName, lastName)}</span>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            id="Consultants.photo.choisir.input"
            type="file"
            accept=".png,.jpg,.jpeg,image/png,image/jpeg"
            disabled={disabled || uploading}
            onChange={choosePhoto}
            className="text-sm text-gray-600 file:mr-2 file:rounded-lg file:border-0 file:bg-brand-600 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-brand-700 disabled:opacity-50"
          />
          {hasPhoto && (
            <Button
              id="Consultants.photo.supprimer"
              type="button"
              onClick={() => void removePhoto()}
              disabled={disabled || uploading}
              className="!w-auto !bg-red-50 !text-red-700 hover:!bg-red-100"
            >
              {tr('Consultants.photo.supprimer')}
            </Button>
          )}
        </div>
      </div>
      <p id="Consultants.photo.formats" className="text-xs text-gray-500">
        {tr('Consultants.photo.format.invalide')}
      </p>
      {uploading && (
        <p id="Consultants.photo.televersement" className="text-xs text-gray-500">
          {tr('Consultants.photo.televersement')}
        </p>
      )}
      {validation && (
        <p id="Consultants.photo.erreur.validation" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {validation === 'format'
            ? tr('Consultants.photo.format.invalide')
            : tr('Consultants.photo.taille.invalide')}
        </p>
      )}
      {error && (
        <p id="Consultants.photo.erreur" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </fieldset>
  )
}
