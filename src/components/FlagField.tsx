import type { ReactNode } from 'react'

/**
 * Champ avec un flag de validation : ✓ vert si valide, sinon X rouge.
 * Le libellé et les flags reçoivent des ids HTML (`id`, `id.valid`, `id.invalid`).
 */
export function FlagField({
  id,
  label,
  valid,
  children,
}: {
  id: string
  label: string
  valid: boolean
  children: ReactNode
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <label id={id} className="block text-sm font-medium text-gray-700">{label}</label>
        {valid ? (
          <span id={`${id}.valid`} className="font-bold text-green-600" title={label}>✓</span>
        ) : (
          <span id={`${id}.invalid`} className="font-bold text-red-600" title={label}>X</span>
        )}
      </div>
      {children}
    </div>
  )
}
