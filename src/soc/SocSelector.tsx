import { tr } from '../i18n/translate'
import { useState } from 'react'
import { useSoc } from './SocContext'
import { AddSocModal } from './AddSocModal'

export function SocSelector() {
  const { socs, selectedSoc, selectSoc, canAddSoc, loading, favoriteSocId, setFavoriteSoc } = useSoc()
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [favoriting, setFavoriting] = useState<number | null>(null)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
        aria-haspopup="listbox"
        aria-expanded={open}
        title={tr('SocSelector.societe.active')}
      >
        <span className="max-w-48 truncate">
          {selectedSoc?.name ?? (socs.length > 0 ? 'Choisir une société' : 'Espace de travail')}
        </span>
        <svg className="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute right-0 z-50 mt-2 w-72 rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
            {loading && socs.length === 0 ? (
              <p className="px-3 py-2 text-sm text-gray-500">{tr('SocSelector.chargement')}</p>
            ) : socs.length === 0 ? (
              <p className="px-3 py-2 text-sm text-gray-500">{tr('SocSelector.aucune.societe.associee')}</p>
            ) : (
              <ul role="listbox" aria-label={tr('SocSelector.societe.active')}>
                {socs.map((soc) => {
                  const isFavorite = soc.id === favoriteSocId
                  const isSelected = soc.id === selectedSoc?.id
                  return (
                    <li key={soc.id} className="flex items-center gap-1">
                      <button
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => {
                          selectSoc(soc.id)
                          setOpen(false)
                        }}
                        className={`flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                          isSelected
                            ? 'bg-brand-50 font-medium text-brand-700'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <span className="truncate">{soc.name}</span>
                        {isSelected && (
                          <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path
                              fillRule="evenodd"
                              d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4l3.3 3.29 7.3-7.3a1 1 0 0 1 1.4 0Z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </button>
                      {canAddSoc && (
                        <button
                          type="button"
                          title={isFavorite ? 'Société favorite' : 'Définir comme favorite'}
                          aria-label={isFavorite ? 'Société favorite' : 'Définir comme favorite'}
                          disabled={favoriting === soc.id}
                          onClick={async (e) => {
                            e.stopPropagation()
                            setFavoriting(soc.id)
                            try {
                              await setFavoriteSoc(soc.id)
                            } finally {
                              setFavoriting(null)
                            }
                          }}
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition hover:bg-amber-50 ${
                            isFavorite ? 'text-amber-500' : 'text-gray-300 hover:text-amber-500'
                          }`}
                        >
                          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path
                              fillRule="evenodd"
                              d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401Z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}

            {canAddSoc && (
              <div className="mt-2 border-t border-gray-100 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    setAdding(true)
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-brand-600 transition hover:bg-brand-50"
                >
                  <span className="text-base leading-none">＋</span>
                  {tr('SocSelector.inscrire.une.societe')}
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {canAddSoc && <AddSocModal open={adding} onClose={() => setAdding(false)} />}
    </div>
  )
}
