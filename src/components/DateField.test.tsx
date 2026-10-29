import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { DateField, toIsoDate } from './DateField'

describe('DateField', () => {
  it('désactive dans le calendrier les dates refusées par filterDate', () => {
    const onChange = vi.fn()
    const { container } = render(
      <DateField
        id="test.date"
        value="2026-11-06"
        onChange={onChange}
        filterDate={(date) => {
          const day = date.getDay()
          return day !== 0 && day !== 6
        }}
      />,
    )

    fireEvent.click(screen.getByDisplayValue('06/11/2026'))

    const disabledDays = container.querySelectorAll('.react-datepicker__day--disabled')
    expect(disabledDays.length).toBeGreaterThan(0)
    const enabledDays = container.querySelectorAll(
      '.react-datepicker__day:not(.react-datepicker__day--disabled):not(.react-datepicker__day--outside-month)',
    )
    expect(enabledDays.length).toBeGreaterThan(0)
  })

  it('convertit une date locale en AAAA-MM-JJ', () => {
    expect(toIsoDate(new Date(2026, 10, 7))).toBe('2026-11-07')
  })
})
