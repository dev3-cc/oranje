# Costos del hotel: contrato de API para backend

Este documento es para el equipo de backend. La app del hotel (Manager General y
Manager de Área) ya consume estos dos endpoints tal como se describen aquí. Mientras no
existan (responden **404**), la app muestra **datos de ejemplo** con un aviso de que
son ficticios. Cuando se publiquen, la app empieza a mostrar los datos reales sin
cambios. Los tipos exactos están en
[`apps/web/src/mobile/hotel/costs/costsContract.ts`](../../web/src/mobile/hotel/costs/costsContract.ts).

## Qué es el costo

**Lo que el hotel le paga a Oranje**: la tarifa del contrato (`contract_rate.bill_rate`)
por hora trabajada, y el overtime con `contract.overtime_bill_multiplier`. Es la misma
fórmula que hoy usa la generación de factura (`invoices.repository.ts`):

```
costo = (minutos_regulares / 60) × bill_rate
      + (minutos_overtime  / 60) × bill_rate × overtime_bill_multiplier
```

- **Nunca** se expone `pay_rate`, `worker_rate` ni el margen: son información interna
  de Oranje (el esquema lo dice en `ContractRate` e `InvoiceDetail`).
- Festivos (`holiday_bill_multiplier`) y el crédito de comida (`deducts_meals`) **no**
  se aplican, igual que la factura de hoy. Si la factura los incorpora, este cálculo
  debe hacerlo también: los dos números tienen que coincidir.

## Alcance y permisos

| Rol                          | Permiso                     | Ve                   |
| ---------------------------- | --------------------------- | -------------------- |
| Manager General (`ROL-H-03`) | `dashboard.read_all`        | Todo su hotel        |
| Manager de Área (`ROL-H-02`) | `dashboard.read_department` | Solo su departamento |

Los dos permisos ya están sembrados y hoy ningún endpoint los usa. El Supervisor no ve
costos.

- **El hotel sale de la sesión** (`user.hotelId`), **nunca de un parámetro**. Ningún
  parámetro puede ampliar el alcance: hoy hay endpoints donde un ID o un
  `?departmentId=` permite salirse del hotel o del departamento, y esto no debe repetirlo.
- El Manager de Área queda limitado a las posiciones de `user.departmentId`.

## La posición de cada hora

El timesheet no guarda la posición. Hay que resolverla así:

```
timesheet (worker_id, requisition_id)
  → assignment (worker_id) → slot → position → catalog_position
```

> ⚠️ **Posible bug en la factura actual.** Cruza el timesheet con **todas** las
> posiciones de la requisición (`JOIN demand."position" p ON p.requisition_id = r.id`).
> Si una requisición pide dos posiciones distintas, las horas de cada persona se
> facturarían dos veces, una con cada tarifa. Vale la pena revisarlo; este cálculo no
> debe heredarlo.

## Información incompleta

Cada semana y cada posición trae `status` (`COMPLETE` | `INCOMPLETE`) y `gaps`, que dice
por qué:

| `gap`                   | Cuándo                                          | Qué hace el número                                                          |
| ----------------------- | ----------------------------------------------- | --------------------------------------------------------------------------- |
| `NO_ACTIVE_CONTRACT`    | El hotel no tiene contrato `ACTIVE`             | Costos en `null`; las horas sí se devuelven                                 |
| `POSITION_WITHOUT_RATE` | Una posición trabajada no tiene `contract_rate` | El `cost` de esa posición es `null`; el total suma solo lo que tiene tarifa |
| `UNAPPROVED_HOURS`      | Hay timesheets que todavía no están `APPROVED`  | `estimatedCost` las incluye; `approvedCost` no                              |
| `UNREVIEWED_ANOMALIES`  | Hay días con `has_anomaly` sin `review_note`    | Las horas pueden corregirse                                                 |

Dinero como **texto decimal** (`"1234.50"`), igual que el resto del API.

## `GET /hotel-costs/weeks?from=YYYY-MM-DD&to=YYYY-MM-DD`

Una fila por semana del hotel (la semana la define el contrato: `week_start_day`). La
app pide las últimas 8.

```json
{
  "data": {
    "currency": "USD",
    "weeks": [
      {
        "weekStart": "2026-10-05",
        "weekEnd": "2026-10-11",
        "isCurrent": true,
        "regularMinutes": 18240,
        "overtimeMinutes": 120,
        "approvedCost": null,
        "estimatedCost": "5341.67",
        "status": "INCOMPLETE",
        "gaps": ["POSITION_WITHOUT_RATE", "UNAPPROVED_HOURS"]
      }
    ]
  }
}
```

- `approvedCost`: solo horas de timesheets `APPROVED`. Es lo que irá a la factura.
- `estimatedCost`: todo lo ponchado, aprobado o no, con las tarifas que existan.
- `isCurrent`: la semana que corre hoy en la zona horaria del hotel.

## `GET /hotel-costs/weeks/:weekStart/positions`

El desglose de una semana por posición del catálogo.

```json
{
  "data": {
    "currency": "USD",
    "weekStart": "2026-09-28",
    "weekEnd": "2026-10-04",
    "positions": [
      {
        "catalogPositionId": "…",
        "positionName": "Camarista",
        "departmentName": "Housekeeping",
        "workers": 6,
        "regularMinutes": 13680,
        "overtimeMinutes": 0,
        "billRate": "18.50",
        "overtimeMultiplier": "1.50",
        "cost": "4218.00",
        "status": "COMPLETE",
        "gaps": []
      },
      {
        "catalogPositionId": "…",
        "positionName": "Supervisor de piso",
        "departmentName": "Housekeeping",
        "workers": 1,
        "regularMinutes": 2400,
        "overtimeMinutes": 0,
        "billRate": null,
        "overtimeMultiplier": null,
        "cost": null,
        "status": "INCOMPLETE",
        "gaps": ["POSITION_WITHOUT_RATE"]
      }
    ]
  }
}
```

## Errores

- **404** solo cuando la ruta no existe. Para la app eso significa "todavía no
  publicado" y muestra el ejemplo. Una semana sin horas devuelve `200` con listas
  vacías, **no** 404.
- **403** sin el permiso.

## Cuando se publique

En la app se borran `costsSample.ts` y la rama del 404 en `costsAppApi.ts`.
