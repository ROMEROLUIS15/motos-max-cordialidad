# Pruebas de rendimiento

## Qué mide esto (y qué no)

`latency.k6.js` es un **gate de latencia**, no una prueba de carga. La diferencia es deliberada.

Una prueba de carga responde a «¿cuántos usuarios simultáneos aguanta?». Este sistema atiende a un taller: siete usuarios, con una concurrencia real de tres o cuatro personas en el peor momento. Escalar esa cifra a cientos de VUs mediría la máquina y el plan de hosting, no el producto.

La pregunta que sí importa es **«¿siguen respondiendo rápido los endpoints cuando los datos crecen?»**. La aritmética de una consulta cambia con el volumen: lo que es instantáneo con 11 órdenes puede no serlo con 20.000. Por eso el gate corre con la **concurrencia real** (4 VUs) contra una base **sembrada con volumen**, y falla si algún endpoint se sale de su presupuesto de latencia.

Cuando el producto pase de un taller a varios (Fase 3: multi-tenant, marketplace), la prueba de carga pasará a ser una pregunta legítima y este script es la base sobre la que construirla.

## Presupuestos

Los umbrales son **objetivos de UX**, no una foto de lo que hoy mide la máquina: si se calibran contra el número actual, el test deja de detectar regresiones y solo certifica el statu quo.

| Endpoint                   | p95    | Por qué                                            |
| -------------------------- | ------ | -------------------------------------------------- |
| `GET /work-orders`         | 400 ms | Listado paginado con joins a cliente y vehículo    |
| `GET /work-orders?search=` | 600 ms | Búsqueda `ILIKE '%…%'` sobre columnas de los joins |
| `GET /work-orders/:id`     | 400 ms | Detalle con líneas, repuestos y pagos              |
| `GET /customers`           | 400 ms | Listado paginado                                   |
| `GET /dashboard/summary`   | 800 ms | Agrega varias consultas                            |

La búsqueda tiene el presupuesto más holgado por una razón estructural: `contains` con `mode: 'insensitive'` se traduce a `ILIKE '%término%'`, que **ningún índice btree puede servir**. Es el primer endpoint que se degradará con el volumen, y es el que este gate vigila.

## Cómo correrlo

El gate necesita datos y una API que no esté limitando peticiones.

```bash
# 1. Base de datos de perf, aparte de la de desarrollo
docker exec motoworkshop_postgres psql -U motoworkshop -d postgres \
  -c "CREATE DATABASE motoworkshop_perf TEMPLATE motoworkshop_dev;"

# 2. Sembrar volumen (2.000 clientes, 2.000 vehículos, 20.000 órdenes; ~8 s)
docker exec -i motoworkshop_postgres psql -U motoworkshop -d motoworkshop_perf \
  -v ON_ERROR_STOP=1 < perf/seed-volume.sql

# 3. API contra esa base
cd apps/api
DATABASE_URL="postgresql://motoworkshop:motoworkshop@localhost:5433/motoworkshop_perf" pnpm start:dev

# 4. El gate
k6 run perf/latency.k6.js
```

## El rate limiting interfiere, y es correcto que lo haga

El throttler global acota **60 peticiones por minuto y ruta** (ver `docs/SECURITY.md`). Un k6 a plena velocidad las agota en segundos y a partir de ahí mide `429`: la métrica global se vuelve inútil (los rechazos son rápidos y hunden el p95 hacia cero).

Dos lecturas correctas:

- **Filtrar por respuestas válidas**: la línea `{ expected_response:true }` de la salida de k6 sólo agrega las 2xx. Es la métrica a mirar si el throttler está activo.
- **Medir sin throttler**: levantar la API de perf con `NODE_ENV=test`, que activa el `skipIf` del `ThrottlerModule` (ver `app.module.ts`). Sólo para el entorno local de medición; nunca en producción, donde el `Dockerfile` fija `NODE_ENV=production`.

**No apuntar este gate a producción.** Es el sistema con el que trabaja un taller real, corre en el plan free de Render (CPU compartida, suspensión por inactividad) y sus números reflejarían el plan, no el código.

## Fichero de siembra

`seed-volume.sql` genera datos con `generate_series`. Reutiliza el tenant, la sucursal, el técnico y la recepción existentes, y marca todo lo suyo con prefijos (`PERF…`, `PRF…`) para poder limpiarlo:

```sql
DELETE FROM work_orders WHERE "orderNumber" LIKE 'PERF-%';
DELETE FROM vehicles    WHERE plate LIKE 'PRF%';
DELETE FROM customers   WHERE "documentNumber" LIKE 'PERF%';
```

Nota de Postgres: `lpad(texto, n)` **trunca** cuando el texto excede `n` (`lpad('1000', 3, '0')` → `'100'`). El ancho de los sufijos generados debe cubrir el máximo de la serie o se producen colisiones en las columnas únicas.
