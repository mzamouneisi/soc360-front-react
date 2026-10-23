import { useState } from 'react'
import { tr } from '../i18n/translate'
import { documentsApi } from '../api/documents'
import { ApiError } from '../api/client'
import { Button, Field, IconButton, Input, Textarea } from './ui'
import { Modal } from './data'

export interface AttachedDocument {
  id: number
  name: string
  comment: string | null
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
      })
      setOpen(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tr('document.attachment.uploadError'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <IconButton
          icon="add"
          label={tr('document.attachment.add')}
          variant="new"
          onClick={openPopup}
          disabled={disabled}
        />
        {value ? (
          <>
            <span className="text-sm text-gray-700">{value.name}</span>
            {value.comment && (
              <span className="text-xs text-gray-500">— {value.comment}</span>
            )}
            <IconButton
              icon="delete"
              label={tr('document.attachment.remove')}
              variant="danger"
              onClick={() => onChange(null)}
              disabled={disabled}
            />
          </>
        ) : (
          <span className="text-sm text-gray-400">{tr('document.attachment.none')}</span>
        )}
      </div>

      <Modal
        open={open}
        title={tr('document.attachment.title')}
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="neutral" onClick={() => setOpen(false)} disabled={saving}>
              {tr('common.cancel')}
            </Button>
            <Button variant="primary" onClick={() => void validate()} disabled={saving}>
              {tr('document.attachment.validate')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label={tr('document.attachment.file')} id="document.attachment.file">
            <Input
              type="file"
              aria-label={tr('document.attachment.file')}
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null)
                setError(null)
              }}
            />
          </Field>
          <Field label={tr('document.attachment.comment')} id="document.attachment.comment">
            <Textarea
              rows={3}
              aria-label={tr('document.attachment.comment')}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </Field>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </Modal>
    </div>
  )
}
