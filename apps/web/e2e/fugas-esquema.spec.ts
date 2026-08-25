import { expect, test, type Page } from '@playwright/test'

const RUTAS = [
  '/dashboard',
  '/pipeline',
  '/propuestas',
  '/conversion',
  '/requisiciones',
  '/requisiciones/autorizacion',
  '/schedule',
  '/timesheet',
  '/timesheet-global',
  '/pool-colaboradores',
  '/self-pick',
  '/reportes',
  '/mi-equipo',
  '/blacklist',
  '/clientes-activos',
  '/documentos-tc',
  '/mi-personal',
  '/mi-territorio',
  '/colaborador/alta-2',
  '/colaborador/alta-3',
  '/colaborador/avisos',
]

const PATRONES: { nombre: string; re: RegExp }[] = [
  {
    nombre: 'esquema.tabla',
    re: /\b(?:personal|commercial|demand|coverage|operations|settlement|notifications|catalogs|identity|supervision|journal)\.[a-z_]+\b/g,
  },
  { nombre: 'vista/guard (vw_, ck_, ux_, ix_)', re: /\b(?:vw|ck|ux|ix)_[a-z_]+\b/g },
  { nombre: 'NOT NULL', re: /\bNOT NULL\b/g },
  { nombre: 'columna snake_case', re: /\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/g },
]

function fugasDe(texto: string): string[] {
  const fugas = new Set<string>()
  for (const { re } of PATRONES) {
    for (const m of texto.matchAll(re)) fugas.add(m[0])
  }
  return [...fugas].sort()
}

async function abrirSesionMock(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('oranje-mock-session', 'true')
  })
}

async function textoVisible(page: Page, ruta: string): Promise<string> {
  await page.goto(ruta)
  await esperarContenido(page)
  await expect(page, `el guard redirigió ${ruta} a /login — nada que auditar`).not.toHaveURL(
    /\/login/,
  )
  const texto = await leerTexto(page)
  expect(
    texto.length,
    `la ruta ${ruta} montó casi vacía (${String(texto.length)} chars)`,
  ).toBeGreaterThan(200)
  return texto
}

async function esperarContenido(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle')
  let previo = -1
  let estables = 0
  for (let i = 0; i < 40; i++) {
    const actual = await page.evaluate(() => document.body.innerText.length)
    estables = actual === previo ? estables + 1 : 0
    if (estables >= 2 && actual > 250) return
    previo = actual
    await page.waitForTimeout(300)
  }
}

async function leerTexto(page: Page): Promise<string> {
  return page.evaluate(() => {
    for (const el of document.querySelectorAll(
      '[class*="material-icons"], [class*="material-symbols"]',
    )) {
      el.remove()
    }
    return document.body.innerText
  })
}

test.beforeEach(async ({ page }) => {
  await abrirSesionMock(page)
})

test.describe('build de producción — el usuario no ve la base', () => {
  test.beforeEach(() => {
    test.skip(test.info().project.name !== 'preview-prod', 'solo corre en preview-prod')
  })

  for (const ruta of RUTAS) {
    test(`sin identificadores de BD en ${ruta}`, async ({ page }) => {
      const texto = await textoVisible(page, ruta)
      const fugas = fugasDe(texto)
      expect(fugas, `Fugas de esquema visibles en ${ruta}: ${fugas.join(' · ')}`).toEqual([])
    })
  }

  test('sin identificadores de BD en el detalle de contrato (documentos-tc → Abrir)', async ({
    page,
  }) => {
    await textoVisible(page, '/documentos-tc')
    await page.getByRole('link', { name: /abrir/i }).first().click()
    await expect(page).toHaveURL(/\/documentos-tc\/.+/)
    await esperarContenido(page)
    const texto = await leerTexto(page)
    expect(texto.length, 'el detalle de contrato montó casi vacío').toBeGreaterThan(400)
    const fugas = fugasDe(texto)
    expect(fugas, `Fugas en el detalle de contrato: ${fugas.join(' · ')}`).toEqual([])
  })

  test('sin identificadores de BD en el Expediente (pool → primer colaborador)', async ({
    page,
  }) => {
    await textoVisible(page, '/pool-colaboradores')
    await page.locator('main a[href*="/pool-colaboradores/"]').first().click()
    await expect(page).toHaveURL(/\/pool-colaboradores\/.+/)
    await esperarContenido(page)
    const texto = await leerTexto(page)
    expect(texto.length, 'el Expediente montó casi vacío').toBeGreaterThan(400)
    const fugas = fugasDe(texto)
    expect(fugas, `Fugas en el Expediente: ${fugas.join(' · ')}`).toEqual([])
  })
})

test.describe('dev local — las anotaciones condicionadas SÍ se ven', () => {
  test.beforeEach(() => {
    test.skip(test.info().project.name !== 'dev-local', 'solo corre en dev-local')
  })

  test('la Blacklist muestra su anotación de esquema en dev', async ({ page }) => {
    const texto = await textoVisible(page, '/blacklist')
    expect(fugasDe(texto).length, 'IS_DEV_UI no encendió en vite dev').toBeGreaterThan(0)
  })

  test('el Pool muestra su anotación de esquema en dev', async ({ page }) => {
    const texto = await textoVisible(page, '/pool-colaboradores')
    expect(texto).toMatch(/vw_worker|personal\.worker/)
  })
})
