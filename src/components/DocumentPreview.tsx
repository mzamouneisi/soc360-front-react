import { tr } from '../i18n/translate'
import { isImageFile } from '../lib/ocr'

/** Aperçu d'un document (image ou PDF) à partir d'une URL blob ou distante. */
export function DocumentPreview({
  url,
  name,
  className = '',
}: {
  url?: string | null
  name?: string | null
  className?: string
}) {
  if (!url || !name) return null
  const image = isImageFile(name)
  const pdf = /\.pdf$/i.test(name) || name.toLowerCase().includes('pdf')

  if (!image && !pdf) return null

  return (
    <div className={`overflow-hidden rounded-lg border border-gray-200 ${className}`}>
      {image ? (
        <img
          src={url}
          alt={tr('document.preview.image')}
          className="max-h-72 w-full object-contain object-left bg-gray-50"
        />
      ) : (
        <iframe
          src={url}
          title={tr('document.preview.pdf')}
          className="h-72 w-full bg-gray-50"
        />
      )}
    </div>
  )
}
