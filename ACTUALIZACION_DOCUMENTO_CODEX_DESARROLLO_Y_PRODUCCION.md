
# ACTUALIZACIÓN DEL DOCUMENTO MAESTRO

## Cambio importante: Entornos de Desarrollo y Producción

### Desarrollo (OBLIGATORIO)

El desarrollador trabajará **SIN Docker**.

El entorno de desarrollo será local y estará compuesto por:

- Node.js instalado localmente.
- NestJS ejecutado con `npm run start:dev`.
- Next.js ejecutado con `npm run dev`.
- MySQL instalado localmente (no dentro de Docker).
- Prisma utilizando la base MySQL local.

Comandos esperados durante el desarrollo:

```bash
npm install
npm run dev
npx prisma migrate dev
```

Docker NO debe ser requisito para desarrollar ni para ejecutar pruebas locales.

La aplicación debe funcionar completamente sin Docker durante el desarrollo.

---

### Producción

Docker se utilizará únicamente como mecanismo de despliegue.

Codex deberá dejar preparados:

- Dockerfile para Backend.
- Dockerfile para Frontend.
- docker-compose.prod.yml

No es necesario crear docker-compose para desarrollo.

En producción podrán ejecutarse mediante Docker:

- Backend (NestJS)
- Frontend (Next.js)

MySQL podrá ejecutarse fuera de Docker o dentro de Docker según la decisión final del administrador.

La aplicación no deberá depender de una única alternativa.

---

## Etapa 0 (MODIFICADA)

La Etapa 0 deberá generar:

- estructura del proyecto;
- backend NestJS;
- frontend Next.js;
- Prisma;
- configuración local de desarrollo;
- Dockerfiles para producción;
- docker-compose.prod.yml;
- LocalStorageProvider;
- README;
- .env.example;
- docs/progress.md.

No deberá requerirse Docker para comenzar a programar.

---

## Instrucción obligatoria para Codex

No asumir que el entorno de desarrollo utiliza Docker.

Todo el código deberá poder ejecutarse localmente mediante Node.js y MySQL instalados en la computadora del desarrollador.

Docker será preparado exclusivamente para el despliegue a producción.

El resto del documento maestro permanece sin cambios.
