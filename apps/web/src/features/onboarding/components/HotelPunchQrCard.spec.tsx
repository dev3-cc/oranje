import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { describe, expect, it } from 'vitest'

import { HotelPunchQrCard } from './HotelPunchQrCard'

import { store } from '@/app/store'

function renderCard(props: Partial<Parameters<typeof HotelPunchQrCard>[0]> = {}): void {
  render(
    <Provider store={store}>
      <HotelPunchQrCard
        hotelId="hotel-1"
        punchMethod="QR"
        punchQr={{ version: 2, generatedAt: '2026-09-07T12:00:00.000Z' }}
        {...props}
      />
    </Provider>,
  )
}

describe('HotelPunchQrCard', () => {
  it('con selfie no ofrece nada que imprimir: solo dice cómo se cambia', () => {
    renderCard({ punchMethod: 'SELFIE', punchQr: null })

    expect(screen.getByText('Selfie')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /imprimir qr/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /regenerar/i })).not.toBeInTheDocument()
  })

  it('con QR enseña la versión, la hoja para imprimir y el botón de regenerar', () => {
    renderCard()

    expect(screen.getByText(/Versión 2/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /imprimir qr/i })).toHaveAttribute(
      'href',
      '/hoteles/hotel-1/qr-ponche',
    )
    expect(screen.getByRole('button', { name: 'Regenerar QR' })).toBeInTheDocument()
  })

  it('regenerar pide un segundo toque y se puede cancelar', async () => {
    renderCard()

    await userEvent.click(screen.getByRole('button', { name: 'Regenerar QR' }))
    expect(
      screen.getByRole('button', { name: /confirmar: el anterior deja de servir/i }),
    ).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.getByRole('button', { name: 'Regenerar QR' })).toBeInTheDocument()
  })
})
