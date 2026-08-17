# Agua Distri

Plataforma SaaS para distribuidoras de agua. Este repositorio comienza en Etapa 0: base tecnica, desarrollo local sin Docker y artefactos Docker solo para produccion.

## Requisitos locales

- Node.js 20.19 o superior.
- npm 10 o superior.
- MySQL 8 local.

Docker no es requisito para desarrollar ni ejecutar pruebas locales.

## Estructura

```text
apps/
  api/   Backend NestJS + Prisma
  web/   Frontend Next.js + Tailwind CSS
docs/
  progress.md
```

## Configuracion local

1. Crear una base MySQL local, por ejemplo `agua_distri`.
2. Copiar variables:

```bash
copy apps\api\.env.example apps\api\.env
copy apps\web\.env.example apps\web\.env.local
```

3. Ajustar `DATABASE_URL` en `apps/api/.env`.

## Instalacion

```bash
npm install
npm run prisma:generate
```

## Desarrollo

Ejecutar backend:

```bash
npm run dev:api
```

Ejecutar frontend:

```bash
npm run dev:web
```

Endpoints iniciales:

- Backend: `http://localhost:3001/api/v1/health`
- Frontend: `http://localhost:3000`

## Prisma

Desarrollo:

```bash
npm run prisma:migrate
npm run prisma:seed
```

Produccion:

```bash
npm run prisma:deploy -w apps/api
```

La Etapa 0 no define tablas comerciales. Incluye solo `app_metadata` como tabla tecnica inicial para validar Prisma y migraciones.

La Etapa 1 agrega el nucleo SaaS:

- `tenants`
- `tenant_settings`
- `users`
- `refresh_tokens`
- `roles`
- `permissions`
- `user_roles`
- `role_permissions`
- `audit_logs`

## Usuarios de prueba

Luego de `npm run prisma:seed`:

| Tipo | Email | Password |
| --- | --- | --- |
| Platform Admin | `platform@aguadistri.local` | `Admin123!` |
| Tenant Norte | `admin@norte.local` | `Admin123!` |
| Tenant Sur | `admin@sur.local` | `Admin123!` |

El login no recibe tenant: el backend deriva el tenant desde el email unico global del usuario autenticado.

## API Etapa 1

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`
- `GET /api/v1/tenants`
- `POST /api/v1/tenants`
- `PATCH /api/v1/tenants/:id`
- `GET /api/v1/users`
- `POST /api/v1/users`
- `PATCH /api/v1/users/:id`
- `GET /api/v1/roles`
- `POST /api/v1/roles`
- `PATCH /api/v1/roles/:id`
- `GET /api/v1/permissions`

## API Etapa 2

- `GET /api/v1/branches`
- `POST /api/v1/branches`
- `PATCH /api/v1/branches/:id`
- `GET /api/v1/warehouses`
- `POST /api/v1/warehouses`
- `PATCH /api/v1/warehouses/:id`
- `GET /api/v1/customers`
- `POST /api/v1/customers`
- `PATCH /api/v1/customers/:id`
- `GET /api/v1/product-categories`
- `POST /api/v1/product-categories`
- `PATCH /api/v1/product-categories/:id`
- `GET /api/v1/products`
- `POST /api/v1/products`
- `PATCH /api/v1/products/:id`
- `GET /api/v1/price-lists`
- `POST /api/v1/price-lists`
- `PATCH /api/v1/price-lists/:id`
- `POST /api/v1/price-lists/customer-product-prices`

Los listados aceptan `search`, `page`, `pageSize` y `active` cuando aplica.

## API Etapa 3

- `GET /api/v1/vehicles`
- `POST /api/v1/vehicles`
- `PATCH /api/v1/vehicles/:id`
- `GET /api/v1/drivers`
- `POST /api/v1/drivers`
- `PATCH /api/v1/drivers/:id`
- `GET /api/v1/inventory`
- `GET /api/v1/inventory/movements`
- `POST /api/v1/inventory/movements`
- `POST /api/v1/inventory/vehicle-load`
- `POST /api/v1/inventory/vehicle-return`

El stock se modifica mediante movimientos. No hay endpoint para editar cantidades directamente.

## API Etapa 4

- `GET /api/v1/orders`
- `GET /api/v1/orders/:id`
- `POST /api/v1/orders`
- `PATCH /api/v1/orders/:id`
- `POST /api/v1/orders/:id/confirm`
- `POST /api/v1/orders/:id/assign`
- `POST /api/v1/orders/:id/cancel`

Los pedidos incluyen items, calculo de precios, descuentos, direccion de entrega, asignacion a chofer/vehiculo, cancelacion e historial. La resolucion de precio usa esta prioridad: precio especifico cliente/producto, lista del cliente, lista default y precio base del producto.

## API Etapa 5

- `GET /api/v1/delivery-routes`
- `GET /api/v1/delivery-routes/:id`
- `POST /api/v1/delivery-routes`
- `PATCH /api/v1/delivery-routes/:id`
- `POST /api/v1/delivery-routes/:id/prepare`
- `POST /api/v1/delivery-routes/:id/load-vehicle`
- `POST /api/v1/delivery-routes/:id/close-preliminary`
- `POST /api/v1/delivery-routes/:id/cancel`

Las rutas agrupan pedidos con secuencia, chofer, vehiculo y deposito de carga. La carga del vehiculo agrega cantidades por producto de los pedidos incluidos y genera movimientos `VEHICLE_LOAD`.

## API Etapas 6 y 7

- `GET /api/v1/driver-mobile/routes`
- `GET /api/v1/driver-mobile/routes/:id`
- `POST /api/v1/driver-mobile/stops/:routeOrderId/complete`
- `POST /api/v1/driver-mobile/stops/:routeOrderId/fail`
- `POST /api/v1/driver-mobile/sync`

El frontend incluye una vista movil en `/mobile`. Permite al repartidor ver rutas asignadas, registrar entregas, marcar entregas fallidas y guardar operaciones offline en `localStorage` para sincronizarlas con idempotencia. GPS, firma y foto respetan la configuracion del tenant.

## API Etapa 8

- `GET /api/v1/containers/types`
- `POST /api/v1/containers/types`
- `GET /api/v1/containers/movements`
- `POST /api/v1/containers/movements`
- `GET /api/v1/containers/balances`

Los movimientos de envases actualizan saldos por cliente y tipo de envase. Pueden vincularse a una entrega mediante `routeOrderId`.

## API Etapa 9

- `GET /api/v1/billing/invoices`
- `POST /api/v1/billing/invoices`
- `POST /api/v1/billing/invoices/from-order`
- `GET /api/v1/billing/payments`
- `POST /api/v1/billing/payments`
- `GET /api/v1/billing/account-statement/:customerId`
- `GET /api/v1/billing/overdue`
- `POST /api/v1/billing/cash-closings`

La cuenta corriente se explica por `account_movements`: facturas generan debito, pagos generan credito y cada movimiento guarda el saldo posterior. No hay integracion ARCA en esta etapa.

## API Etapa 10

- `GET /api/v1/recurring-orders/rules`
- `POST /api/v1/recurring-orders/rules`
- `POST /api/v1/recurring-orders/rules/:id/suspend`
- `POST /api/v1/recurring-orders/rules/:id/activate`
- `POST /api/v1/recurring-orders/rules/:id/exceptions`
- `POST /api/v1/recurring-orders/generate`

Los pedidos recurrentes permiten reglas diarias, semanales y mensuales, excepciones de salto, suspension/reactivacion y generacion de pedidos futuros sin duplicar la misma regla y fecha objetivo.

## API Etapa 11

- `GET /api/v1/subscriptions/plans`
- `POST /api/v1/subscriptions/plans`
- `GET /api/v1/subscriptions`
- `POST /api/v1/subscriptions`
- `POST /api/v1/subscriptions/usage`
- `GET /api/v1/subscriptions/:id/summary`
- `POST /api/v1/subscriptions/:id/renew`
- `POST /api/v1/subscriptions/:id/suspend`
- `POST /api/v1/subscriptions/:id/cancel`

Los abonos definen planes con cantidades incluidas por producto, clientes abonados, periodos vigentes, consumo, renovacion, suspension/cancelacion y resumen de incluido, usado, restante y excedente.

## API Etapa 12

- `GET /api/v1/dispensers/models`
- `POST /api/v1/dispensers/models`
- `GET /api/v1/dispensers`
- `POST /api/v1/dispensers`
- `GET /api/v1/dispensers/:id/history`
- `GET /api/v1/dispensers/comodatos/list`
- `POST /api/v1/dispensers/comodatos`
- `POST /api/v1/dispensers/comodatos/:id/retire`
- `POST /api/v1/dispensers/maintenance`
- `POST /api/v1/dispensers/maintenance/:id/complete`

Dispensers permite modelos, equipos por numero de serie, comodatos, entregas, retiros, mantenimientos, reparaciones e historial para conocer ubicacion actual y trazabilidad de cada equipo.

## API Etapa 13

- `GET /api/v1/reports/kpis`
- `GET /api/v1/reports/export`

Los informes calculan indicadores desde datos transaccionales: ventas, cobranzas, deuda, clientes, rutas, productos, envases, dispensers y litros. La exportacion devuelve contenido CSV.

## API Etapa 14

- `GET /api/v1/alerts/rules`
- `POST /api/v1/alerts/rules`
- `GET /api/v1/alerts`
- `POST /api/v1/alerts`
- `POST /api/v1/alerts/:id/acknowledge`
- `POST /api/v1/alerts/:id/resolve`
- `POST /api/v1/alerts/scan`
- `GET /api/v1/alerts/notifications/list`
- `POST /api/v1/alerts/notifications/dispatch`

Las alertas cubren facturas vencidas, clientes inactivos, renovacion de abonos, mantenimiento de dispensers y alertas manuales. Las notificaciones quedan en cola y el despacho marca envios reales solo cuando el canal esta disponible.

## API Etapa 15

- `GET /api/v1/integrations`
- `POST /api/v1/integrations`
- `GET /api/v1/integrations/webhooks`
- `POST /api/v1/integrations/webhooks`
- `GET /api/v1/integrations/events`
- `POST /api/v1/integrations/events`
- `POST /api/v1/integrations/events/process`
- `GET /api/v1/integrations/api-keys`
- `POST /api/v1/integrations/api-keys`
- `POST /api/v1/integrations/api-keys/:id/revoke`

La etapa prepara ARCA, Mercado Pago, WhatsApp Business, Google Maps, optimizacion de rutas, S3/R2/MinIO, webhooks y API publica mediante configuracion, eventos y claves. No realiza llamadas externas sin credenciales ni autorizacion especifica.

## Produccion con Docker

Docker se usa solo como mecanismo de despliegue:

```bash
docker compose -f docker-compose.prod.yml up --build
```

Si se desea usar MySQL dentro del compose:

```bash
docker compose -f docker-compose.prod.yml --profile mysql up --build
```

MySQL tambien puede ejecutarse fuera de Docker configurando `DATABASE_URL`.

## Storage

El backend usa una abstraccion `StorageProvider` con implementacion inicial `LocalStorageProvider`. Los archivos se guardan en `LOCAL_STORAGE_ROOT`; la base de datos almacenara metadatos en etapas posteriores.
