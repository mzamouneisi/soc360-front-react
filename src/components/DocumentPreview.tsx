import { useEffect, useState } from 'react'
import { tr } from '../i18n/translate'
import { isImageFile } from '../lib/ocr'
import { Icon } from './icons'
import { Modal } from './data'

const TEXT_EXT = /\.(txt|csv|md|json|xml|log)$/i
const OFFICE_EXT = /\.(docx?|xlsx?|pptx?|odt|ods|rtf)$/i
const FIRST_PAGE_LINES = 25

function isPdfFile(name: string): boolean {
  return /\.pdf$/i.test(name) || name.toLowerCase().includes('pdf')
}

function isTextFile(name: string): boolean {
  return TEXT_EXT.test(name)
}

function isOfficeFile(name: string): boolean {
  return OFFICE_EXT.test(name)
}

function firstPage(text: string): string {
  return text.split('\n').slice(0, FIRST_PAGE_LINES).join('\n')
}

/** Aperçu d'un document (image, PDF, texte, bureautique) à partir d'une URL blob ou distante. */
export function DocumentPreview({
  url,
  name,
  className = '',
  id,
}: {
  url?: string | null
  name?: string | null
  className?: string
  id?: string
}) {
  const [fullOpen, setFullOpen] = useState(false)
  const [text, setText] = useState<string | null>(null)
  const [textError, setTextError] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [fullSize, setFullSize] = useState(false)

  const image = !!name && isImageFile(name)
  const pdf = !!name && isPdfFile(name)
  const textType = !!name && isTextFile(name)
  const office = !!name && isOfficeFile(name)

  useEffect(() => {
    if (!url || !name || !isTextFile(name)) {
      setText(null)
      setTextError(false)
      return
    }
    let cancelled = false
    setTextError(false)
    void fetch(url)
      .then((response) => (response.ok ? response.text() : Promise.reject(new Error('fetch'))))
      .then((value) => {
        if (!cancelled) setText(value)
      })
      .catch(() => {
        if (!cancelled) setTextError(true)
      })
    return () => {
      cancelled = true
    }
  }, [url, name])

  if (!url || !name) return null
  if (!image && !pdf && !textType && !office) return null

  const openFull = () => setFullOpen(true)

  return (
    <>
      <div
        id={id}
        role="button"
        tabIndex={0}
        title={tr('document.attachment.view')}
        aria-label={tr('document.attachment.view')}
        onClick={openFull}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            openFull()
          }
        }}
        className={`cursor-zoom-in overflow-hidden rounded-lg border border-gray-200 ${className}`}
      >
        {image && (
          <img
            id={id ? `${id}.image` : undefined}
            src={url}
            alt={tr('document.preview.image')}
            className="max-h-72 w-full object-contain object-left bg-gray-50"
          />
        )}
        {pdf && (
          <iframe
            id={id ? `${id}.pdf` : undefined}
            src={`${url}#page=1&toolbar=0&navpanes=0&view=FitH`}
            title={tr('document.preview.pdf')}
            className="pointer-events-none h-72 w-full bg-gray-50"
          />
        )}
        {textType && (
          <pre
            id={id ? `${id}.text` : undefined}
            className="max-h-72 overflow-hidden whitespace-pre-wrap break-words bg-gray-50 px-3 py-2 text-xs text-gray-700"
          >
            {textError
              ? tr('document.preview.unavailable')
              : text == null
                ? tr('common.loading')
                : firstPage(text)}
          </pre>
        )}
        {office && (
          <div
            id={id ? `${id}.office` : undefined}
            className="flex h-40 flex-col items-center justify-center gap-2 bg-gray-50 px-4 text-center text-sm text-gray-600"
          >
            <Icon name="view" className="h-8 w-8 text-brand-600" />
            <span className="font-medium text-gray-800">{name}</span>
            <span className="text-xs text-gray-500">{tr('document.preview.firstPage')}</span>
          </div>
        )}
      </div>

      {fullOpen && (
        <Modal
          open
          title={name}
          titleId="document.preview.full.title"
          onClose={() => setFullOpen(false)}
          size={fullSize ? 'full' : 'xl'}
        >
          <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
            {(image || textType) && (
              <>
                <button
                  id="document.preview.zoom.out"
                  type="button"
                  title={tr('document.preview.zoomOut')}
                  className="rounded-lg border border-gray-300 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  onClick={() => setZoom((value) => Math.max(0.5, value - 0.25))}
                >
                  −
                </button>
                <span id="document.preview.zoom.value" className="text-sm text-gray-600">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  id="document.preview.zoom.in"
                  type="button"
                  title={tr('document.preview.zoomIn')}
                  className="rounded-lg border border-gray-300 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  onClick={() => setZoom((value) => Math.min(3, value + 0.25))}
                >
                  +
                </button>
              </>
            )}
            <button
              id="document.preview.size"
              type="button"
              title={fullSize ? tr('document.preview.reduce') : tr('document.preview.expand')}
              className="rounded-lg border border-gray-300 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50"
              onClick={() => setFullSize((value) => !value)}
            >
              {fullSize ? tr('document.preview.reduce') : tr('document.preview.expand')}
            </button>
          </div>
          <div style={{ maxHeight: fullSize ? '80vh' : '65vh' }} className="overflow-auto">
            {image && (
              <img
                id="document.preview.full.image"
                src={url}
                alt={tr('document.preview.image')}
                style={{ width: `${zoom * 100}%`, maxWidth: 'none' }}
                className="mx-auto block object-contain"
              />
            )}
            {pdf && (
              <iframe
                id="document.preview.full.pdf"
                src={url}
                title={tr('document.preview.pdf')}
                className={fullSize ? 'h-[78vh] w-full' : 'h-[65vh] w-full'}
              />
            )}
            {textType && (
              <pre
                id="document.preview.full.text"
                style={{ fontSize: `${Math.round(12 * zoom)}px` }}
                className="whitespace-pre-wrap break-words rounded-lg bg-gray-50 px-3 py-2 text-gray-700"
              >
                {text ?? ''}
              </pre>
            )}
            {office && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Icon name="view" className="h-6 w-6 text-brand-600" />
                  <span>{name}</span>
                </div>
                <iframe
                  id="document.preview.full.office"
                  src={url}
                  title={name}
                  className={fullSize ? 'h-[72vh] w-full' : 'h-[60vh] w-full'}
                />
                <a
                  id="document.preview.full.open"
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium text-brand-600 underline hover:text-brand-700"
                >
                  {tr('document.attachment.view')}
                </a>
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  )
}
