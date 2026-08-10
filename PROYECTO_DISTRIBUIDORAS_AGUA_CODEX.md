# PROYECTO: Plataforma SaaS para Distribuidoras de Agua
## Documento maestro de especificación funcional y técnica para Codex

**Objetivo de este documento:** servir como fuente principal de contexto, alcance, arquitectura, reglas y etapas de desarrollo para Codex.

---

# 1. FORMA DE TRABAJO OBLIGATORIA

El proyecto debe desarrollarse **por etapas**, de manera incremental.

Codex NO debe intentar desarrollar toda la aplicación de una sola vez.

La dinámica será:

1. El usuario indicará explícitamente: **“Comenzar Etapa X”**.
2. Codex deberá analizar únicamente esa etapa y sus dependencias ya existentes.
3. Codex implementará lo definido para esa etapa.
4. Deberá dejar la aplicación ejecutable y testeable.
5. El usuario realizará pruebas funcionales.
6. Se corregirán errores o ajustes de esa etapa.
7. Solo cuando el usuario lo indique se continuará con la siguiente etapa.

**Regla crítica:** Codex no debe comenzar una etapa futura sin autorización explícita.

Puede preparar estructuras genéricas necesarias para el crecimiento futuro, pero no debe implementar funcionalidades que pertenezcan a etapas posteriores si no fueron solicitadas.

Antes de modificar código existente:
- revisar la arquitectura actual;
- reutilizar componentes y servicios;
- evitar duplicar lógica;
- no romper funcionalidades ya aprobadas;
- mantener compatibilidad con datos existentes.

---

# 2. OBJETIVO GENERAL

Desarrollar una plataforma web y móvil para la gestión integral de distribuidoras de agua, bidones, botellas, soda, dispensers y productos relacionados.

La plataforma será del tipo **SaaS multi-tenant**.

Cada distribuidora será un `tenant` independiente y podrá administrar sus propios:

- usuarios;
- roles y permisos;
- sucursales;
- depósitos;
- clientes;
- direcciones;
- productos;
- categorías;
- listas de precios;
- stock;
- vehículos;
- choferes/repartidores;
- pedidos;
- rutas;
- entregas;
- facturas;
- pagos;
- cuentas corrientes;
- envases retornables;
- abonos;
- dispensers;
- comodatos;
- mantenimientos;
- reportes;
- configuraciones.

Los datos de una distribuidora nunca deben ser visibles para otra.

---

# 3. ARQUITECTURA GENERAL

## Backend
- Node.js
- TypeScript
- NestJS
- API REST versionada

## Base de datos
- MySQL 8
- Prisma ORM
- Prisma Migrations

## Frontend Web
- React
- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui

## Aplicación móvil
- React Native
- Expo
- TypeScript

## Infraestructura inicial
- Docker
- MySQL
- Backend NestJS
- Frontend Next.js
- almacenamiento local de archivos en el servidor

## Infraestructura preparada para incorporar posteriormente
- Redis
- BullMQ
- almacenamiento compatible S3 / Cloudflare R2 / MinIO
- workers
- servicios de notificaciones

---

# 4. PRINCIPIO SAAS MULTI-TENANT

Cada distribuidora será un tenant.

Tabla principal:

`tenants`

Todas las entidades comerciales pertenecientes a una distribuidora deberán quedar asociadas directa o indirectamente a un `tenant_id`.

Ejemplos:

- users
- customers
- products
- orders
- invoices
- payments
- vehicles
- routes
- inventory

## Regla de seguridad fundamental

El backend nunca debe confiar en un `tenant_id` enviado desde el frontend.

El tenant debe derivarse del usuario autenticado.

Toda consulta deberá estar limitada al tenant correspondiente.

Ejemplo conceptual:

```sql
WHERE tenant_id = authenticated_user.tenant_id
```

Deben existir tests automáticos que demuestren que un usuario del tenant A no puede consultar, modificar ni eliminar información del tenant B.

---

# 5. ADMINISTRADOR DE PLATAFORMA

Debe existir un nivel superior denominado `Platform Admin`.

Funciones futuras:

- crear distribuidoras;
- activar/desactivar tenants;
- administrar planes;
- definir límites;
- consultar estado general;
- administrar funcionalidades disponibles;
- suspender servicios;
- consultar métricas generales de la plataforma.

El Platform Admin no debe confundirse con el administrador interno de una distribuidora.

---

# 6. ROLES Y PERMISOS

Implementar RBAC (Role-Based Access Control).

Tablas mínimas:

- roles
- permissions
- user_roles
- role_permissions

Los roles no deben estar fijos en código.

Cada distribuidora podrá crear, modificar o eliminar sus propios roles cuando corresponda.

Ejemplos:

- Administrador
- Encargado
- Ventas
- Facturación
- Chofer
- Depósito
- Cobranzas

Ejemplos de permisos:

- customers.view
- customers.create
- customers.update
- customers.delete
- products.view
- products.create
- orders.view
- orders.create
- orders.update
- orders.cancel
- invoices.create
- invoices.cancel
- payments.create
- routes.create
- routes.assign
- reports.sales.view

---

# 7. CONFIGURACIÓN POR DISTRIBUIDORA

Cada tenant deberá disponer de configuraciones propias.

Ejemplos:

- permite stock negativo;
- usa envases retornables;
- usa dispensers;
- usa abonos;
- requiere firma;
- GPS desactivado / opcional / obligatorio;
- permite fotografías de entrega;
- foto opcional / obligatoria;
- permite modificar cantidades durante entrega;
- permite ventas adicionales durante reparto;
- permite alta de clientes desde móvil;
- facturación automática;
- control de stock activado;
- lista de precios predeterminada;
- términos de pago;
- moneda;
- zona horaria.

Las reglas comerciales deben ser configurables siempre que sea razonable y no estar hardcodeadas.

---

# 8. GEOLOCALIZACIÓN / GPS

La geolocalización debe ser **opcional y configurable por tenant**.

Modos previstos:

1. GPS desactivado.
2. GPS opcional.
3. GPS obligatorio al confirmar una entrega.

La ubicación se obtiene desde el teléfono del repartidor mediante las APIs de ubicación de Android/iOS.

Cuando se capture una ubicación deben poder guardarse:

- latitude;
- longitude;
- accuracy;
- captured_at.

No implementar seguimiento continuo del repartidor en la primera versión.

La arquitectura podrá quedar preparada para una funcionalidad futura de tracking si se requiere.

Uso recomendado:

- capturar ubicación del cliente al darlo de alta o durante su primera entrega;
- capturar ubicación del repartidor al confirmar una entrega;
- comparar ambas ubicaciones;
- opcionalmente advertir si la distancia excede un límite configurable.

---

# 9. ALMACENAMIENTO DE ARCHIVOS

En la primera versión, todos los archivos se almacenarán **localmente en el servidor**.

Ejemplos:

- logos;
- fotos de productos;
- firmas;
- fotos de entregas;
- comprobantes;
- PDFs;
- archivos importados/exportados.

No guardar archivos binarios dentro de MySQL.

MySQL almacenará únicamente metadatos y referencias.

Ejemplo conceptual:

- id
- tenant_id
- entity_type
- entity_id
- file_name
- storage_key
- mime_type
- size
- created_at

## Regla de arquitectura

Crear una abstracción de almacenamiento.

Ejemplo conceptual:

```ts
storage.save()
storage.get()
storage.delete()
```

La aplicación no debe depender directamente de rutas físicas hardcodeadas.

Implementación inicial:

`LocalStorageProvider`

En el futuro deberá ser posible agregar:

- S3StorageProvider
- R2StorageProvider
- MinioStorageProvider

sin modificar la lógica de negocio.

---

# 10. PRISMA Y BASE DE DATOS

La estructura MySQL se gestionará mediante Prisma.

Codex deberá mantener:

- `prisma/schema.prisma`
- migraciones Prisma
- archivos `migration.sql`

Toda modificación estructural deberá realizarse mediante migraciones.

No modificar manualmente producción.

En desarrollo:

```bash
npx prisma migrate dev
```

En producción:

```bash
npx prisma migrate deploy
```

Los archivos SQL generados por Prisma deberán conservarse versionados en el repositorio.

---

# 11. REGLAS DEL MODELO DE DATOS

El modelo deberá ser normalizado, preferentemente hasta Tercera Forma Normal cuando resulte adecuado.

Usar:

- Primary Keys;
- Foreign Keys;
- Unique Constraints;
- índices;
- índices compuestos;
- relaciones muchos-a-muchos mediante tablas intermedias.

Índices frecuentes deberán considerar primero `tenant_id`.

Ejemplos:

```text
INDEX(tenant_id, status)
INDEX(tenant_id, delivery_date)
INDEX(tenant_id, customer_id)
```

No usar `float` para dinero.

Usar `DECIMAL`.

Fechas persistidas en UTC.

Visualización según timezone del tenant.

Preferir soft delete para maestros cuando corresponda.

No eliminar físicamente historia comercial crítica.

---

# 12. AUDITORÍA

Implementar `audit_logs` para operaciones sensibles.

Registrar:

- tenant_id;
- user_id;
- action;
- entity;
- entity_id;
- old_values;
- new_values;
- ip;
- user_agent;
- timestamp.

Auditar especialmente:

- cancelación de pedidos;
- modificación de precios;
- anulación de facturas;
- ajustes de stock;
- modificación/eliminación de pagos;
- cambios de roles;
- cambios de permisos.

---

# 13. CLIENTES

El cliente deberá soportar:

- persona;
- empresa;
- revendedor.

Información posible:

- razón social;
- nombre;
- apellido;
- identificación fiscal;
- teléfono;
- email;
- límite de crédito;
- condiciones de pago;
- lista de precios;
- estado;
- observaciones;
- fecha de alta.

Un cliente podrá tener varias direcciones.

Cada dirección podrá almacenar:

- calle;
- localidad;
- provincia;
- código postal;
- latitud;
- longitud;
- referencia;
- observaciones de reparto;
- contacto;
- teléfono;
- dirección principal.

---

# 14. PRODUCTOS

Campos mínimos:

- tenant_id;
- sku;
- código de barras;
- nombre;
- descripción;
- categoría;
- unidad;
- litros;
- costo;
- precio;
- impuesto;
- activo;
- retornable;
- requiere envase.

El campo `litros` debe permitir calcular automáticamente litros vendidos.

Ejemplos:

- Bidón 20 L
- Bidón 12 L
- Soda
- Pack 6 x 2 L
- Dispenser
- Bomba manual

---

# 15. LISTAS DE PRECIOS

Cada tenant podrá definir múltiples listas:

- Minorista
- Mayorista
- Empresas
- Revendedores
- Especial

Tablas conceptuales:

- price_lists
- price_list_items
- customer_product_prices

Debe permitirse un precio específico de producto para un cliente cuando sea necesario.

---

# 16. STOCK

El stock deberá gestionarse mediante movimientos.

Nunca modificar cantidades sin trazabilidad.

Tablas:

- inventory
- inventory_movements

Tipos de movimiento previstos:

- PURCHASE
- SALE
- DELIVERY
- RETURN
- TRANSFER
- ADJUSTMENT
- VEHICLE_LOAD
- VEHICLE_RETURN

Debe existir stock por depósito.

---

# 17. VEHÍCULOS COMO STOCK MÓVIL

Cada vehículo podrá actuar como ubicación móvil de stock durante una ruta.

Flujo:

```text
Depósito
  ↓
Carga vehículo
  ↓
Stock vehículo
  ↓
Entregas / ventas adicionales
  ↓
Devolución de sobrantes
  ↓
Cierre de reparto
```

Registrar:

- carga inicial;
- productos entregados;
- ventas adicionales;
- devoluciones;
- sobrantes;
- diferencias.

---

# 18. ENVASES RETORNABLES

Los envases deben controlarse separadamente del producto vendido.

Ejemplo:

cliente recibe 2 bidones llenos;
devuelve 1 vacío;
saldo de envases = 1.

Tablas conceptuales:

- container_types
- container_movements
- customer_container_balances

Debe poder conocerse:

- envases entregados;
- envases recuperados;
- pendientes;
- perdidos;
- saldo por cliente.

---

# 19. VEHÍCULOS

Campos sugeridos:

- tenant_id;
- patente;
- marca;
- modelo;
- año;
- capacidad;
- estado;
- vencimiento seguro;
- vencimiento documentación;
- vencimiento revisión técnica.

---

# 20. CHOFERES / REPARTIDORES

Los choferes estarán relacionados con usuarios.

Datos adicionales:

- licencia;
- categoría;
- vencimiento;
- estado.

---

# 21. PEDIDOS

Estados iniciales:

- DRAFT
- PENDING
- CONFIRMED
- ASSIGNED
- IN_ROUTE
- DELIVERED
- PARTIALLY_DELIVERED
- FAILED
- CANCELLED

Campos:

- tenant;
- cliente;
- dirección;
- fecha pedido;
- fecha entrega;
- estado;
- ruta;
- chofer;
- vehículo;
- subtotal;
- descuento;
- impuestos;
- total;
- observaciones;
- creador.

Detalle en `order_items`.

---

# 22. PEDIDOS RECURRENTES

Permitir reglas como:

- cada lunes;
- lunes y jueves;
- cada 7 días;
- cada 15 días;
- mensual.

La aplicación podrá generar pedidos futuros automáticamente.

No implementar esta automatización hasta la etapa correspondiente.

---

# 23. RUTAS Y REPARTOS

Una ruta tendrá:

- tenant;
- fecha;
- vehículo;
- chofer;
- pedidos;
- secuencia;
- estado.

Ejemplo:

1. Cliente A
2. Cliente B
3. Cliente C
4. Cliente D

El sistema deberá permitir posteriormente visualización en mapa y futura optimización de recorridos.

---

# 24. ENTREGA

Una entrega podrá registrar:

- pedido;
- cliente;
- hora prevista;
- hora real;
- estado;
- GPS;
- productos entregados;
- productos rechazados;
- envases entregados;
- envases recibidos;
- pago;
- firma opcional;
- foto opcional;
- observaciones;
- motivo de falla.

Motivos de entrega fallida:

- Cliente ausente
- Cerrado
- Pedido rechazado
- Dirección incorrecta
- Sin dinero
- Cancelado
- Otro

---

# 25. VENTA ADICIONAL EN REPARTO

El repartidor podrá, si el tenant lo permite, agregar productos a una entrega.

Ejemplo:

pedido original:
- 2 bidones

venta final:
- 3 bidones
- 1 soda

La operación deberá actualizar coherentemente:

- entrega;
- stock;
- pedido/facturación;
- cuenta corriente si corresponde.

---

# 26. FACTURACIÓN

Tablas conceptuales:

- invoices
- invoice_items

Estados:

- DRAFT
- ISSUED
- PAID
- PARTIALLY_PAID
- CANCELLED

Diseñar un servicio fiscal desacoplado para futura integración con ARCA.

La integración ARCA no forma parte del MVP salvo indicación explícita.

---

# 27. PAGOS Y COBRANZAS

Formas de pago:

- efectivo;
- transferencia;
- tarjeta;
- QR;
- Mercado Pago;
- cheque;
- cuenta corriente;
- otro.

Tablas:

- payments
- payment_allocations

Un pago podrá aplicarse a una o varias facturas.

---

# 28. CUENTA CORRIENTE

Usar movimientos.

No almacenar únicamente un saldo editable.

Tipos:

- INVOICE
- PAYMENT
- CREDIT_NOTE
- DEBIT_NOTE
- ADJUSTMENT

Debe permitir:

- ver movimientos;
- calcular saldo;
- deuda vencida;
- registrar cobros;
- imprimir/exportar estado de cuenta.

---

# 29. DISPENSERS Y COMODATOS

Tablas conceptuales:

- equipment
- equipment_models
- customer_equipment
- equipment_movements

Registrar:

- número de serie;
- modelo;
- estado;
- cliente;
- entrega;
- retiro;
- garantía;
- mantenimiento;
- observaciones.

Movimientos:

- entrega;
- retiro;
- cambio;
- mantenimiento;
- reparación;
- baja.

---

# 30. ABONOS

Ejemplos:

- 10 bidones/mes;
- 20 bidones/mes;
- 40 bidones/mes;
- plan corporativo.

Tablas conceptuales:

- subscription_plans
- customer_subscriptions
- subscription_consumptions

Controlar:

- cantidad incluida;
- consumida;
- disponible;
- adicional;
- renovación;
- importe;
- estado.

---

# 31. APP MÓVIL DEL REPARTIDOR

Debe priorizar operación rápida con pocos toques.

Funciones previstas:

- iniciar sesión;
- ver recorrido;
- ver clientes;
- ver pedidos;
- ver saldo;
- ver envases;
- ver última compra;
- confirmar entrega;
- modificar cantidades;
- agregar productos;
- registrar envases;
- registrar devolución;
- registrar cobro;
- crear pedido;
- crear cliente;
- capturar GPS si corresponde;
- capturar firma si corresponde;
- tomar foto si corresponde;
- observaciones;
- informar entrega fallida;
- trabajo offline parcial;
- sincronización posterior.

La primera versión móvil no necesita implementar todas estas funciones simultáneamente.

---

# 32. CIERRE DE REPARTO

Al finalizar una ruta mostrar:

- pedidos asignados;
- entregados;
- fallidos;
- productos cargados;
- vendidos;
- devueltos;
- envases;
- efectivo;
- transferencias;
- otros cobros;
- diferencias de stock;
- diferencias de caja.

El chofer confirma el cierre.

Un supervisor podrá aprobarlo.

---

# 33. DASHBOARD Y KPIs

## Comercial
- ventas;
- ticket promedio;
- productos vendidos;
- litros vendidos;
- ventas por producto;
- ventas por cliente;
- ventas por zona;
- ventas por repartidor;
- clientes nuevos;
- clientes activos;
- clientes inactivos.

## Logística
- entregas planificadas;
- entregas realizadas;
- fallidas;
- porcentaje de cumplimiento;
- tiempo promedio;
- pedidos por ruta;
- litros por ruta.

## Financiero
- facturado;
- cobrado;
- saldo pendiente;
- deuda vencida;
- días promedio de cobro.

## Envases
- entregados;
- recuperados;
- pendientes;
- saldo por cliente.

---

# 34. HISTORIAL 360° DEL CLIENTE

La ficha deberá centralizar:

- datos;
- direcciones;
- pedidos;
- facturas;
- pagos;
- cuenta corriente;
- envases;
- dispensers;
- abonos;
- entregas;
- observaciones;
- última compra;
- frecuencia;
- consumo promedio;
- litros consumidos.

---

# 35. ALERTAS

Preparar el sistema para alertas como:

- deuda vencida;
- cliente sin comprar hace X días;
- abono próximo a vencer;
- mantenimiento pendiente;
- licencia por vencer;
- seguro por vencer;
- stock bajo;
- envases pendientes excesivos.

---

# 36. NOTIFICACIONES

Arquitectura preparada para:

- email;
- WhatsApp Business;
- push notifications.

Ejemplos futuros:

- pedido programado;
- pedido en camino;
- pedido entregado;
- recordatorio de deuda.

---

# 37. REDIS Y BULLMQ

No son obligatorios para la primera etapa funcional.

La arquitectura debe permitir incorporarlos posteriormente.

## Redis
Usos futuros:

- cache;
- rate limiting;
- datos temporales;
- soporte para colas.

## BullMQ
Usos futuros:

- envío de WhatsApp;
- emails;
- generación de PDFs;
- reportes pesados;
- importaciones;
- generación automática de pedidos;
- tareas programadas.

No usar Redis/BullMQ innecesariamente antes de que exista un caso real.

---

# 38. API

Versionada:

```text
/api/v1/
```

Ejemplos:

- /api/v1/customers
- /api/v1/products
- /api/v1/orders
- /api/v1/routes
- /api/v1/invoices

Cada request protegido deberá verificar:

- usuario;
- autenticación;
- tenant;
- rol;
- permiso.

---

# 39. AUTENTICACIÓN

Implementar:

- access token;
- refresh token;
- password hashing;
- recuperación de contraseña;
- cambio de contraseña;
- sesiones;
- bloqueo/desactivación de usuario.

Preparar arquitectura para MFA futuro.

---

# 40. TRANSACCIONES

Usar transacciones para operaciones atómicas.

Ejemplo de confirmación de entrega:

- actualizar entrega;
- actualizar pedido;
- movimiento de stock;
- movimiento de envases;
- factura si corresponde;
- pago si corresponde.

Si algo falla, revertir el conjunto cuando corresponda.

---

# 41. IDEMPOTENCIA

Las operaciones móviles deben soportar idempotencia cuando corresponda.

Evitar duplicaciones por reintentos de red.

No duplicar:

- entrega;
- pago;
- factura;
- movimiento de stock.

---

# 42. TESTING

Implementar:

- unit tests;
- integration tests;
- tests de API.

Prioridad:

- multi-tenancy;
- roles/permisos;
- stock;
- entregas;
- pagos;
- facturas;
- cuenta corriente;
- envases.

Cada etapa deberá incluir criterios de aceptación y pruebas.

---

# 43. IMPORTACIÓN Y EXPORTACIÓN

Preparar:

Importación:
- clientes;
- productos;
- precios;
- stock.

Exportación:
- CSV;
- Excel;
- PDF.

---

# 44. DESPLIEGUE INICIAL

Servidor inicial disponible:

- Intel Core i5-1250P
- 12 núcleos / 16 hilos
- 24 GB RAM

El servidor es suficiente para desarrollo, pruebas y primera producción controlada.

Arquitectura inicial recomendada mediante Docker:

```text
reverse-proxy
frontend
backend
mysql
```

Posteriormente:

```text
redis
worker
scheduler
```

El almacenamiento de archivos será local inicialmente.

Debe existir backup periódico de:

1. MySQL.
2. Carpeta de archivos (`storage`).

---

# 45. ETAPAS DE DESARROLLO

## ETAPA 0 — Inicialización y arquitectura

Objetivo:
crear la base técnica del proyecto.

Incluye:

- monorepo o estructura acordada;
- backend NestJS;
- frontend Next.js;
- TypeScript;
- Prisma;
- MySQL;
- Docker;
- variables de entorno;
- configuración de desarrollo;
- estructura modular;
- health check;
- logging básico;
- LocalStorageProvider;
- documentación de ejecución;
- README.

No desarrollar módulos comerciales todavía.

### Criterio de aceptación
- proyecto levanta correctamente;
- frontend puede comunicarse con backend;
- backend conecta con MySQL;
- Prisma funciona;
- Docker funciona;
- health check responde;
- estructura está documentada.

---

## ETAPA 1 — Núcleo SaaS, autenticación y seguridad

Incluye:

- tenants;
- tenant_settings básicas;
- usuarios;
- autenticación;
- refresh tokens;
- roles;
- permisos;
- user_roles;
- role_permissions;
- Platform Admin básico;
- auditoría inicial;
- aislamiento multi-tenant;
- pantalla login;
- gestión básica de usuarios;
- gestión de roles/permisos.

### Pruebas obligatorias
- login válido;
- login inválido;
- usuario desactivado;
- refresh token;
- permisos;
- tenant A no accede a tenant B;
- creación/modificación de roles;
- auditoría de operaciones críticas.

### Criterio de aceptación
No avanzar hasta que multi-tenancy y seguridad estén probados.

---

## ETAPA 2 — Maestros comerciales

Incluye:

- sucursales;
- depósitos;
- clientes;
- direcciones;
- categorías;
- productos;
- listas de precios;
- precios específicos por cliente;
- búsqueda;
- CRUD web;
- filtros;
- paginación;
- validaciones.

### Criterio de aceptación
Debe poder cargarse una distribuidora real con sus clientes, productos y precios.

---

## ETAPA 3 — Stock, vehículos y choferes

Incluye:

- inventario;
- movimientos;
- stock por depósito;
- vehículos;
- choferes;
- documentación;
- carga de vehículo;
- devolución de vehículo;
- stock móvil.

### Criterio de aceptación
Debe poder reconstruirse el stock exclusivamente mediante movimientos.

---

## ETAPA 4 — Pedidos

Incluye:

- pedidos;
- items;
- estados;
- descuentos;
- precios;
- dirección de entrega;
- asignación;
- cancelación;
- historial;
- validaciones.

### Criterio de aceptación
Un pedido debe poder crearse, modificarse, confirmarse, asignarse y cancelarse correctamente.

---

## ETAPA 5 — Rutas y distribución web

Incluye:

- rutas;
- asignación de pedidos;
- chofer;
- vehículo;
- secuencia;
- estados;
- preparación de reparto;
- carga del vehículo;
- cierre de reparto preliminar.

GPS no es obligatorio en esta etapa.

### Criterio de aceptación
Debe poder prepararse una ruta completa desde la aplicación web.

---

## ETAPA 6 — Aplicación móvil del repartidor (MVP)

Incluye inicialmente:

- login;
- rutas asignadas;
- clientes de la ruta;
- pedidos;
- confirmación de entrega;
- modificación autorizada de cantidades;
- venta adicional si está habilitada;
- cobro básico;
- observaciones;
- entrega fallida.

GPS, firma y foto deben respetar configuración del tenant.

### Criterio de aceptación
Un repartidor debe poder completar una jornada básica desde el teléfono.

---

## ETAPA 7 — GPS, firma, fotos y offline

Incluye:

- GPS opcional/obligatorio;
- coordenadas del cliente;
- coordenadas de entrega;
- precisión;
- distancia respecto del cliente;
- firma digital;
- fotos opcionales;
- almacenamiento local en servidor;
- operación offline parcial;
- cola local de sincronización;
- idempotencia.

No implementar tracking GPS continuo salvo solicitud explícita.

### Criterio de aceptación
El móvil debe poder registrar entregas sin conectividad y sincronizarlas sin duplicación.

---

## ETAPA 8 — Envases retornables

Incluye:

- tipos de envase;
- movimientos;
- entregados;
- recuperados;
- saldo;
- envases por cliente;
- integración con entrega;
- reportes.

### Criterio de aceptación
Debe poder determinarse con precisión cuántos envases tiene cada cliente.

---

## ETAPA 9 — Facturación, pagos y cuenta corriente

Incluye:

- facturas;
- items;
- pagos;
- asignación de pagos;
- cuenta corriente;
- saldo;
- deuda vencida;
- estados de cuenta;
- cierre de caja/reparto.

ARCA no se integra todavía salvo solicitud.

### Criterio de aceptación
Toda deuda debe poder explicarse por sus movimientos.

---

## ETAPA 10 — Pedidos recurrentes

Incluye:

- reglas de recurrencia;
- frecuencia;
- días;
- generación de pedidos;
- suspensión;
- excepciones;
- programación.

En esta etapa podrá incorporarse BullMQ/Redis si aporta valor.

### Criterio de aceptación
El sistema genera correctamente los pedidos futuros sin duplicarlos.

---

## ETAPA 11 — Abonos

Incluye:

- planes;
- clientes abonados;
- cantidades incluidas;
- consumo;
- excedentes;
- renovación;
- estados.

### Criterio de aceptación
Debe conocerse consumo incluido, usado, restante y excedente.

---

## ETAPA 12 — Dispensers, comodatos y mantenimiento

Incluye:

- equipos;
- modelos;
- números de serie;
- comodatos;
- entregas;
- retiros;
- mantenimiento;
- reparaciones;
- historial.

### Criterio de aceptación
Debe conocerse dónde está cada dispenser y su historial.

---

## ETAPA 13 — Dashboard, KPIs e informes

Incluye:

- dashboards;
- litros;
- ventas;
- cobranzas;
- deuda;
- clientes;
- rutas;
- productos;
- envases;
- exportaciones.

Redis podrá usarse para cache cuando sea necesario.

### Criterio de aceptación
Los indicadores deben coincidir con los datos transaccionales.

---

## ETAPA 14 — Alertas y notificaciones

Incluye:

- alertas;
- tareas programadas;
- email;
- preparación para WhatsApp;
- push futuro;
- vencimientos;
- clientes inactivos.

Aquí Redis/BullMQ puede incorporarse formalmente.

---

## ETAPA 15 — Integraciones externas y escalabilidad

Solo bajo autorización.

Posibles integraciones:

- ARCA;
- Mercado Pago;
- WhatsApp Business API;
- Google Maps;
- servicios de optimización de rutas;
- S3;
- Cloudflare R2;
- MinIO;
- webhooks;
- API pública.

---

# 46. PROTOCOLO PARA INICIAR UNA ETAPA

Cuando el usuario diga:

**“Comenzar Etapa X”**

Codex deberá responder primero con un análisis breve que incluya:

1. objetivo de la etapa;
2. módulos involucrados;
3. tablas nuevas o modificadas;
4. endpoints necesarios;
5. pantallas;
6. riesgos;
7. migraciones previstas;
8. pruebas previstas.

Luego podrá implementar.

No volver a preguntar por decisiones ya definidas en este documento salvo contradicción técnica real.

---

# 47. PROTOCOLO AL FINALIZAR UNA ETAPA

Codex deberá informar:

- archivos creados;
- archivos modificados;
- migraciones creadas;
- comandos a ejecutar;
- variables de entorno nuevas;
- endpoints;
- usuarios/datos de prueba;
- pasos concretos para probar;
- tests ejecutados;
- errores conocidos;
- qué NO se implementó por pertenecer a etapas futuras.

Debe dejar un resumen persistente en un archivo como:

`docs/progress.md`

con:

- etapa completada;
- fecha;
- funcionalidades;
- decisiones tomadas;
- pendientes.

---

# 48. REGLAS DE CALIDAD DE CÓDIGO

- TypeScript estricto.
- Evitar `any` innecesario.
- Validar DTOs.
- Separar controller/service/domain.
- No poner lógica comercial compleja en controllers.
- Usar nombres consistentes.
- Manejar errores de forma centralizada.
- Logging estructurado.
- No exponer stack traces a usuarios.
- No guardar secretos en Git.
- `.env` fuera del repositorio.
- incluir `.env.example`.
- documentar decisiones relevantes.

---

# 49. REGLA DE COMPATIBILIDAD

Una etapa posterior no deberá romper una etapa anterior ya aprobada.

Toda modificación de tablas deberá realizarse mediante nuevas migraciones.

Nunca borrar y recrear la base de producción como método normal de evolución.

---

# 50. PRIORIDAD GENERAL

El orden de prioridad del sistema será:

1. Integridad de datos.
2. Seguridad multi-tenant.
3. Correcta operación comercial.
4. Trazabilidad.
5. Facilidad de uso.
6. Rendimiento.
7. Escalabilidad.
8. Funciones avanzadas.

---

# 51. VISIÓN FINAL

El producto debe evolucionar hacia un ERP vertical especializado en distribución de agua capaz de responder:

- qué se vendió;
- cuánto se vendió;
- cuántos litros;
- a qué cliente;
- quién lo entregó;
- en qué vehículo;
- qué ruta recorrió;
- cuánto se cobró;
- cuánto se debe;
- qué envases están afuera;
- qué dispenser tiene cada cliente;
- qué clientes dejaron de comprar;
- qué productos rotan más;
- qué rutas son más eficientes;
- qué zonas son más rentables.

---

# 52. INSTRUCCIÓN FINAL A CODEX

Este documento es la especificación maestra del proyecto.

No asumir que todo debe construirse ahora.

Desarrollar únicamente la etapa que el usuario autorice explícitamente.

Cuando existan varias soluciones posibles:
- priorizar simplicidad;
- integridad;
- mantenibilidad;
- seguridad;
- escalabilidad razonable.

Si una decisión puede comprometer la arquitectura futura, explicarla antes de implementarla.

