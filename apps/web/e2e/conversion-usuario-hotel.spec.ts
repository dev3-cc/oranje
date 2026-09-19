import { expect, test } from '@playwright/test'

/**
 * El recorrido que confundió al usuario real: en Conversión, el requisito
 * «Usuario del Hotel» ofrecía un botón «Crear usuario» sin explicar QUÉ es esa
 * cuenta ni qué va a pasar al picarlo. Este spec recorre el flujo completo
 * (con mocks) y fija lo que la pantalla debe DECIR, no solo hacer.
 */
test.describe('Conversión · Usuario del Hotel', () => {
  test('el requisito explica qué es la cuenta, a quién crea y qué habilita', async ({ page }) => {
    /* La «cookie» del refresh en modo mock: la sesión reanuda sin Firebase. */
    await page.addInitScript(() => {
      localStorage.setItem('oranje-mock-session', 'true')
    })

    await page.goto('/conversion')
    await expect(page.getByRole('heading', { name: 'Conversión' })).toBeVisible()

    // Entra al primer candidato en Rosa.
    await page.locator('a[href^="/conversion/"]').first().click()
    await expect(page.getByRole('heading', { name: 'Conversión a cliente activo' })).toBeVisible()

    // El requisito del Usuario del Hotel: se explica antes de pedir el clic.
    const requirement = page.locator('li', { hasText: 'Usuario del Hotel' }).first()
    await expect(requirement).toBeVisible()
    // QUÉ es: la cuenta con la que el hotel opera Oranje.
    await expect(requirement).toContainText(/cuenta con la que el hotel/i)
    // A QUIÉN crea: el contacto principal, con su correo visible.
    await expect(requirement).toContainText('@')
    // QUÉ habilita: pedir personal y aprobar horas.
    await expect(requirement).toContainText(/requisiciones/i)

    // El botón dice la acción completa, no un «Crear usuario» a secas.
    await expect(requirement.getByRole('button', { name: /Crear cuenta del hotel/ })).toBeVisible()

    // Crearla cumple el requisito y desbloquea Aprobar.
    await requirement.getByRole('button', { name: /Crear cuenta del hotel/ }).click()
    await expect(page.getByRole('button', { name: 'Aprobar conversión' })).toBeEnabled()
  })
})
