/**
 * Seed del esquema — Fase 3 del Plan de Implementación.
 *
 * Las reglas del negocio son FILAS, no código: sin las transiciones sembradas
 * el servicio de transición devuelve 409 a todo y el semáforo no camina.
 *
 * Pendiente de sembrar:
 *   1. Los 7 semáforos en catalogs.status_light
 *   2. Los 9 estados y las 12 transiciones del Semáforo Onboarding
 *      (fuente: Ventas/Semáforo Onboarding y Base de Datos.drawio, página 3)
 *   3. catalogs.status_change_reason
 *   4. Catálogos del vault: Posiciones, Zonas, Niveles de Inglés,
 *      Departamentos del Hotel, Modalidades de Contratación
 *   5. La Matriz de Permisos en identity.role_permission
 *
 * Regla que no se rompe: ningún ambiente que no sea producción lleva PII real
 * (Estándares de Desarrollo §8).
 */
function main(): never {
  throw new Error('Seed pendiente: ver Fase 3 del Plan de Implementación - Base de Datos')
}

main()
