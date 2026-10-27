import { useEffect, useState } from 'react'
import { tr } from '../i18n/translate'
import { documentsApi } from '../api/documents'
import { ApiError } from '../api/client'
import { Button, Field, IconButton, Input, Textarea } from './ui'
import { Modal } from './data'
import { DocumentPreview } from './DocumentPreview'
import { isImageFile } from '../lib/ocr'
import { dialog } from './dialog'

export interface AttachedDocument {
  id: number
  name: string
  comment: string | null
  /** Document téléversé dans cette session et pas encore enregistré sur la demande. */
  temporary?: boolean
}

export function DocumentView({ value }: { value: AttachedDocument | null | undefined }) {
  if (!value) return null
  return (
    <div id="document.view" className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 px-3 py-2">
      <span id="document.attachment.label" className="text-sm font-medium text-gray-700">{tr('document.attachment.label')}</span>
      <span id="document.attachment.name" className="text-sm text-gray-700">{value.name}</span>
      {value.comment && <span id="document.attachment.comment.value" className="text-xs text-gray-500">— {value.comment}</span>}
      <IconButton
        id="document.attachment.view"
        icon="download"
        label={tr('document.attachment.view')}
        onClick={() => {
          void documentsApi.download(value.id, value.name).catch((err) => {
            void dialog.error(
              err instanceof ApiError ? err.message : tr('document.attachment.downloadError'),
            )
          })
        }}
      />
    </div>
  )
}

export function DocumentAttachment({
  value,
  onChange,
  socId,
  consultantId,
  disabled = false,
}: {
  value: AttachedDocument | null
  onChange: (document: AttachedDocument | null) => void
  socId?: number | null
  consultantId?: number | null
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [existingPreviewUrl, setExistingPreviewUrl] = useState<string | null>(null)
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!value) {
      setExistingPreviewUrl(null)
      return
    }
    const previewable = isImageFile(value.name) || /\.pdf$/i.test(value.name)
    if (!previewable) {
      setExistingPreviewUrl(null)
      return
    }
    let cancelled = false
    let objectUrl: string | null = null
    void documentsApi
      .previewUrl(value.id)
      .then((url) => {
        objectUrl = url
        if (!cancelled) setExistingPreviewUrl(url)
      })
      .catch(() => {
        if (!cancelled) setExistingPreviewUrl(null)
      })
    return () => {
      cancelled = true
      setExistingPreviewUrl(null)
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [value?.id, value?.name])

  useEffect(() => {
    if (!file) {
      setFilePreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(file)
    setFilePreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  function openPopup() {
    setFile(null)
    setComment('')
    setError(null)
    setOpen(true)
  }

  async function validate() {
    if (!file) {
      setError(tr('document.attachment.requiredFile'))
      return
    }
    setSaving(true)
    setError(null)
    try {
      const uploaded = await documentsApi.upload(file, {
        socId: socId ?? undefined,
        consultantId: consultantId ?? undefined,
        category: 'JUSTIFICATIF',
        description: comment.trim() || null,
        visibility: 'PRIVATE',
      })
      onChange({
        id: uploaded.id,
        name: uploaded.name,
        comment: comment.trim() || null,
        temporary: true,
      })
      setOpen(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tr('document.attachment.uploadError'))
    } finally {
      setSaving(false)
    }
  }

  async function removeDocument() {
    if (!value) return
    if (value.temporary) {
      try {
        await documentsApi.delete(value.id)
      } catch {
        // Le document peut déjà avoir été supprimé : on détache quand même la demande.
      }
    }
    onChange(null)
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <IconButton
          id="document.attachment.add"
          icon="add"
          label={tr('document.attachment.add')}
          variant="new"
          onClick={openPopup}
          disabled={disabled || value != null}
        />
        {value ? (
          <>
            <span id="document.attachment.selected.name" className="text-sm text-gray-700">{value.name}</span>
            {value.comment && (
              <span id="document.attachment.selected.comment" className="text-xs text-gray-500">— {value.comment}</span>
            )}
            <IconButton
              id="document.attachment.selected.view"
              icon="download"
              label={tr('document.attachment.view')}
              onClick={() => {
                void documentsApi.download(value.id, value.name).catch((err) => {
                  void dialog.error(
                    err instanceof ApiError ? err.message : tr('document.attachment.downloadError'),
                  )
                })
              }}
            />
            <IconButton
              id="document.attachment.remove"
              icon="delete"
              label={tr('document.attachment.remove')}
              variant="danger"
              onClick={() => void removeDocument()}
              disabled={disabled}
            />
          </>
        ) : (
          <span id="document.attachment.none" className="text-sm text-gray-400">{tr('document.attachment.none')}</span>
        )}
      </div>
      {value && existingPreviewUrl && (
        <DocumentPreview id="document.attachment.preview" url={existingPreviewUrl} name={value.name} className="mt-2" />
      )}

      <Modal
        open={open}
        title={tr('document.attachment.title')}
        titleId="document.attachment.title"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button id="document.attachment.cancel" variant="neutral" onClick={() => setOpen(false)} disabled={saving}>
              {tr('common.cancel')}
            </Button>
            <Button id="document.attachment.validate" variant="primary" onClick={() => void validate()} disabled={saving}>
              {tr('document.attachment.validate')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label={tr('document.attachment.file')} id="document.attachment.file">
            <Input
              id="document.attachment.file.input"
              type="file"
              accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
              aria-label={tr('document.attachment.file')}
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null)
                setError(null)
              }}
            />
          </Field>
          {file && filePreviewUrl && (
            <DocumentPreview id="document.attachment.file.preview" url={filePreviewUrl} name={file.name} />
          )}
          <Field label={tr('document.attachment.comment')} id="document.attachment.comment">
            <Textarea
              id="document.attachment.comment.textarea"
              rows={3}
              aria-label={tr('document.attachment.comment')}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </Field>
          {error && <p id="document.attachment.error" className="text-sm text-red-600">{error}</p>}
        </div>
      </Modal>
    </div>
  )
}
