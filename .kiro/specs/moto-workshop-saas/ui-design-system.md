# UI Design System — MotoWorkshop SaaS

> Documento de definición de diseño (frontend). Lo redacta el dev senior; el dueño lo afina.
> Estado: **BORRADOR para revisión**. Mood elegido: **Oscuro técnico y nítido**.

---

## 0. Qué es esto y qué NO es

Esto **no** es un dashboard de marketing bonito. Es una **herramienta operativa** que recepción, técnicos y el dueño usan **todo el día**. El diseño se juzga por: ¿se lee rápido?, ¿el estado de una orden se entiende de un vistazo?, ¿meto datos sin fricción?, ¿en móvil sigue siendo usable en el mostrador?

El "se ve senior / no genérico" **no** viene del color de moda — viene de **componentes hechos para el dominio**: el sistema de estados de orden, los tres niveles de stock, los badges con significado, las tablas densas pero legibles, y los estados vacío/carga/error cuidados. Eso es lo que define este documento.

---

## 1. Principios de UX (no negociables)

1. **El estado manda.** Toda entidad con ciclo de vida (orden, cotización, stock, pago) comunica su estado con **color + texto + icono**, nunca solo color (accesibilidad).
2. **Densidad con aire.** Tablas como ciudadano de primera clase: filas compactas (40–44px), números **tabulares** alineados a la derecha, pero con jerarquía y espacio para respirar.
3. **Una acción primaria por pantalla.** Botón primario único y claro; el resto, secundario/fantasma.
4. **Datos reales o estado honesto.** Cada lista/tarjeta tiene sus tres estados diseñados: **cargando** (skeleton), **vacío** (icono + qué hacer), **error** (mensaje + reintentar). Nunca una pantalla en blanco o un error crudo.
5. **Móvil de verdad (375px).** El mostrador usa el celular. `sm` apila y colapsa nav; `md` muestra sidebar + tablas con scroll; `lg` layout completo (per spec §11).
6. **Rol-consciente.** Dueño ve finanzas; técnico ve sus órdenes y stock; recepción ve el flujo cliente→orden→cobro. La UI prioriza lo de cada rol (no esconde, pero ordena).
7. **Rápido y sobrio.** Transiciones 150–200ms, nada que rebote. Respetar `prefers-reduced-motion`.

---

## 2. Identidad visual

### 2.1 Color — base oscura, color con significado

Base neutra fría, casi negra. El acento (índigo) se usa **poco**: marca, foco, dato activo. El color "de verdad" se reserva para **estados**.

| Token              | HSL (dark)                     | Uso                                  |
| ------------------ | ------------------------------ | ------------------------------------ |
| `background`       | `220 14% 5%`                   | fondo app (casi negro)               |
| `card`             | `220 12% 9%`                   | superficies elevadas                 |
| `border`           | `220 10% 16%`                  | líneas finas (hairline)              |
| `foreground`       | `210 16% 96%`                  | texto principal                      |
| `muted-foreground` | `218 9% 60%`                   | texto secundario                     |
| `primary` (acento) | **`187 85% 53%` cian técnico** | marca, foco, activo — **uso medido** |

**Sistema de estados de Orden de Trabajo** (los 6 estados del dominio — esto es lo que hace que NO se vea genérico):

| Estado          | Color                 | Lectura                                                           |
| --------------- | --------------------- | ----------------------------------------------------------------- |
| `PENDING`       | slate `218 10% 58%`   | en cola, sin empezar                                              |
| `IN_PROGRESS`   | azul `217 91% 62%`    | en taller, activa                                                 |
| `WAITING_PARTS` | ámbar `38 95% 58%`    | **bloqueada** por repuestos                                       |
| `COMPLETED`     | violeta `262 70% 68%` | lista, por entregar (violeta para no chocar con el cian de marca) |
| `DELIVERED`     | verde `152 56% 48%`   | cerrada OK                                                        |
| `CANCELLED`     | rojo `0 72% 60%`      | cancelada                                                         |

**Sistema de Stock** (tres niveles del dominio — siempre se muestra `disponible`):

| Situación       | Color  | Regla                 |
| --------------- | ------ | --------------------- |
| Sano            | neutro | `disponible` ≥ mínimo |
| Bajo            | ámbar  | `disponible` < mínimo |
| Crítico/Agotado | rojo   | `disponible` ≤ 0      |

Cada badge de stock muestra **disponible** y, en detalle, el desglose `físico / reservado / disponible`.

### 2.2 Tipografía

- Fuente: **Inter** (UI) con números **tabulares** activados para datos (`tnum`).
- Escala: Display 28/600 · H1 20/600 · H2 16/600 · Body 14/400 · Small 13 · Micro 11–12 (labels en mayúsculas, `tracking-wide`).
- Headings con `tracking-tight`. Dinero y cantidades **siempre tabulares y alineados a la derecha**.

### 2.3 Forma, profundidad y movimiento

- Radios: tarjetas 12px, controles/inputs 8px, badges full.
- Profundidad: **borde fino + highlight superior** (`inset 0 1px 0 rgba(255,255,255,.06)`), sombra mínima. Nada de sombras pesadas.
- Glow ambiental sutil del fondo (ya implementado), discreto.
- Movimiento: hover/transiciones 150ms ease-out; entrada de vistas 400ms; respetar reduced-motion.

---

## 3. Componentes del sistema (qué construyo)

**Base (shadcn/ui, ya iniciado):** Button, Card, Badge, Input, Select, Skeleton, Dialog/Drawer, Table, Tooltip, DropdownMenu, Tabs, Toast.

**De dominio (lo diferenciador):**

- `StatusBadge` — badge de estado de orden (color+icono+texto) y de cotización.
- `StockIndicator` — número disponible + nivel (sano/bajo/crítico) + desglose en tooltip.
- `DataTable` — tabla con filtros, orden, paginación offset (per spec), densidad compacta, fila→drawer, responsive (scroll en `md`, cards apiladas en `sm`).
- `EntityDrawer` — panel lateral de detalle (Órdenes, Cliente, Repuesto) sin salir de la lista.
- `StatCard` — KPI con número tabular grande, label, y delta cuando aplique.
- `PhotoDropzone` — carga drag&drop de evidencias (ingreso/proceso/entrega).
- `EmptyState` / `ErrorState` / loading **skeletons** por módulo.
- `PageHeader` — título + acción primaria + filtros, consistente en todas las páginas.

---

## 4. UX por pantalla (alineado al spec §11)

- **Dashboard (`/`)** — KPIs (cobrado hoy/mes, órdenes activas, ciclo), tendencia de ingresos 30d, próximas a vencer, stock bajo, top técnicos/repuestos. Selector de sucursal (OWNER) + rango de fechas. Polling 60s.
- **Órdenes (`/work-orders`)** ← _pantalla insignia_ — `DataTable` con filtros (estado/técnico/fecha), `StatusBadge`, drawer de detalle con líneas/repuestos/evidencias/historial, cambio de estado inline con confirmación, `PhotoDropzone`.
- **Clientes (`/customers`)** — tabla + búsqueda, detalle con vehículos e historial de órdenes.
- **Inventario (`/inventory`)** — tabla de repuestos con `StockIndicator`; modal de movimientos (entrada/salida/ajuste/transferencia).
- **Catálogo de servicios (`/service-catalog`)** — tabla + filtro por tipo, CRUD en modal, base para autocompletar líneas de orden.
- **Mensajes (`/messages`)** — inbox de sesiones WhatsApp + panel de conversación + respuesta manual + indicador "IA respondiendo".
- **Ajustes (`/settings`)** y **Auditoría (`/audit`)** — formularios y tabla de auditoría con filtros.

---

## 5. Plan de ejecución

1. **Afinar la base de tokens** a esta paleta (estados + stock) y los componentes base. _(refina lo ya iniciado, no se tira)_
2. **Construir la pantalla insignia `Órdenes`** completa a este estándar = el "norte visual".
3. **Iterar `Órdenes`** con tu feedback hasta el "esto sí".
4. **Replicar** el lenguaje al resto de páginas, una por una.

---

## 6. Decisiones (cerradas 2026-06-25)

- [x] **Acento: cian técnico** (`187 85% 53%`) sobre base oscura.
- [x] **Marca: "Motos Max Cordialidad"** en el sidebar.
- [x] **Idioma: español 100%** (estados "En proceso", "Esperando repuestos", etc.).
- [ ] ¿Colores de marca existentes (factura, fachada, redes) a respetar? _(pendiente — si aparecen, ajustamos tokens)_
- [ ] Logo gráfico definitivo (hoy: icono de moto en cuadro cian).
