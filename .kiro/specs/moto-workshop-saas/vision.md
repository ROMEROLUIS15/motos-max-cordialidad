# Vision — MotoWorkshop SaaS

---

## Declaración de Visión

**MotoWorkshop SaaS** es la plataforma de gestión operativa diseñada para talleres y concesionarios de motocicletas en Latinoamérica. Digitaliza completamente la operación del taller — desde la recepción del vehículo hasta el cobro — centralizando inventario, órdenes de trabajo, comunicación con clientes y analítica financiera en un solo sistema.

El sistema nace con inteligencia artificial integrada, no como un add-on, sino como un componente del flujo de trabajo que reduce la carga operativa repetitiva, protege al taller de reclamos legales y le habla al cliente en su idioma, por el canal que ya usa: WhatsApp.

---

## Problema que Resuelve

Los talleres de motocicletas en Latinoamérica operan hoy con una mezcla de hojas de cálculo, cuadernos físicos, grupos de WhatsApp informales y herramientas de software genérico no adaptadas a la industria. Esto genera:

- **Pérdida de trazabilidad**: sin historial confiable por vehículo, cada servicio empieza desde cero.
- **Quiebres de inventario**: el stock se maneja de forma reactiva, sin alertas ni reservas vinculadas a órdenes activas.
- **Reclamos sin respaldo**: ausencia de evidencia fotográfica del estado de ingreso del vehículo expone legalmente al taller.
- **Comunicación fragmentada**: los clientes preguntan por WhatsApp personal, las respuestas llegan tarde o se pierden.
- **Decisiones sin datos**: el dueño no tiene visibilidad en tiempo real de ingresos, productividad por técnico ni partes de mayor rotación.

---

## Propuesta de Valor

| Para | El problema | MotoWorkshop SaaS ofrece |
|------|-------------|--------------------------|
| Dueño del taller | No sabe cuánto generó hoy ni qué técnico rinde más | Dashboard en tiempo real con métricas de pagos reales y ranking de técnicos |
| Recepcionista | Gestiona clientes, órdenes y WhatsApp desde herramientas separadas | Una sola interfaz para todo el flujo: recepción → orden → cotización → cobro |
| Técnico | No sabe qué órdenes tiene asignadas ni qué repuestos hay disponibles | Vista personal de órdenes asignadas y consulta de stock en tiempo real |
| Cliente | Tiene que llamar para saber si su moto está lista | Notificación automática por WhatsApp al completar el servicio |
| Taller (legal) | Sin evidencia del estado del vehículo al ingreso | Foto de recepción vinculada a cada orden, conservada permanentemente |

---

## Usuarios Objetivo

**Fase 1 — Taller en Barranquilla, Colombia:**

- **OWNER** (dueño): visión estratégica, métricas financieras, configuración del sistema.
- **ADMIN** (jefe de taller): supervisión operativa, gestión de técnicos, reportes.
- **RECEPTIONIST** (recepcionista): atención al cliente, creación de órdenes, WhatsApp, cotizaciones, cobros.
- **TECHNICIAN** (técnico): ejecución de órdenes asignadas, registro de partes utilizadas, evidencias fotográficas.
- **VIEWER** (observador): lectura sin capacidad de escritura, para auditores o socios.

**Expansión futura:**
- Concesionarios con múltiples sucursales en distintas ciudades.
- Talleres de cadena en Colombia, México, Perú, Chile.

---

## Alcance — Fase 1

### Incluido

- Multi-tenant y multi-sucursal (activo desde el primer día)
- Gestión de clientes y vehículos con historial completo
- Recepción formal de vehículos con fotografías de ingreso
- Órdenes de trabajo con ciclo de vida completo
- Inventario de repuestos con tres niveles de stock (físico / reservado / disponible)
- Registro manual de pagos (CASH, TRANSFER, CARD, OTHER)
- Cotizaciones en PDF con ciclo de vida (DRAFT → SENT → APPROVED/REJECTED/EXPIRED)
- Evidencias fotográficas por fase (INGRESO, PROCESO, ENTREGA)
- Dashboard con métricas financieras basadas en pagos reales
- Integración WhatsApp (Meta Cloud API): notificaciones automáticas + mensajería manual
- Agente de IA Router: responde consultas frecuentes por WhatsApp vía Tools tipadas
- Notificaciones internas en tiempo real por WebSocket
- Roles y permisos granulares por tenant
- Observabilidad con Sentry
- Auditoría inmutable de 2 años

### Fuera de Alcance — Fase 1

- Integración con DIAN (facturación electrónica) — abstracción preparada
- Módulo de venta de motocicletas nuevas/usadas — entidades definidas en dominio
- Agentes IA especializados (Fase 2: CommercialAgent, WorkshopAgent, FinancialAgent, ManagementAgent)
- SupervisorAgent de orquestación multiagente (Fase 3)
- Integraciones bancarias o pasarelas de pago en línea
- Panel SuperAdmin de la plataforma

---

## Visión a Largo Plazo

MotoWorkshop SaaS escala de un taller piloto en Barranquilla a una plataforma regional que conecta a cientos de talleres y concesionarios con sus clientes, sus finanzas y sus equipos técnicos. Los agentes de IA evolucionan desde responder preguntas frecuentes hasta gestionar autonomamente el ciclo completo de ventas, servicio y retención de clientes.

La plataforma se convierte en el sistema operativo del sector de motocicletas en Latinoamérica.
