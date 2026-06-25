# Engineering Manifesto — MotoWorkshop SaaS

---

## Principios No Negociables

Estos principios no son aspiracionales. Son restricciones de diseño que aplican a cada decisión técnica del proyecto, desde el primer commit hasta producción.

---

### 1. Clean Architecture — Las capas no se cruzan

El código se organiza en cuatro capas con dependencias que van en una sola dirección: hacia adentro.

```
presentation → application → domain ← infrastructure
```

- **domain**: entidades, objetos de valor, agregados, interfaces de repositorio, excepciones de dominio. Cero dependencias externas.
- **application**: casos de uso. Orquestan el dominio. No conocen frameworks ni implementaciones concretas.
- **infrastructure**: Prisma, Redis, BullMQ, Cloudflare R2, Meta WhatsApp API, DeepSeek, Groq. Implementan las interfaces del dominio.
- **presentation**: controllers NestJS, resolvers. Solo traducen HTTP a casos de uso y viceversa.

**Regla absoluta**: ningún módulo del dominio importa desde infraestructura. Si ves un import de Prisma en una entidad de dominio, es un bug de arquitectura.

---

### 2. Toda la lógica de negocio vive en casos de uso

Los controllers no toman decisiones de negocio. Los repositorios no contienen lógica. Los servicios de infraestructura no saben qué significa una WorkOrder.

Cada operación de negocio es un caso de uso con una sola responsabilidad, testeable de forma aislada con repositorios falsos.

---

### 3. Los agentes de IA nunca tocan la base de datos

Los AIAgents interactúan con el dominio exclusivamente a través de Tools tipadas. Una Tool es una función con schema validado que invoca un caso de uso. Eso es todo.

```
AIAgent → Tool (schema validado) → UseCase → Repository (interface) → Prisma
```

Si un agente necesita un dato que no tiene Tool, la respuesta es crear la Tool — no darle acceso a la base de datos.

---

### 4. El sistema funciona sin IA

La caída de DeepSeek, Groq o ambos no degrada ninguna funcionalidad operativa del taller. Las funciones de IA son una capa de conveniencia sobre un sistema que ya funciona completamente sin ella.

El fallback está definido en cada punto de integración con LLMs. Los mensajes WhatsApp se encolan en BullMQ si el proveedor no responde.

---

### 5. TypeScript Strict Mode en todo el código

```json
{ "strict": true }
```

Sin excepciones. Sin `any`. Sin `as unknown as`. Sin type assertions que no se justifiquen.

El compilador es el primer revisor de código. Si TypeScript no se queja, el código está estructuralmente correcto. Si requiere `any` para compilar, hay un problema de diseño.

---

### 6. Multi-tenant desde el primer commit

Cada entidad persistida tiene `tenant_id`. Cada consulta filtra por `tenant_id`. El aislamiento de datos no es una feature que se agrega después — es una restricción de diseño que se implementa en la base desde el día uno.

Un dato que cruza la frontera de tenant es una brecha de seguridad, no un bug menor.

---

### 7. Los precios históricos son inmutables

Cuando un Part se agrega a una WorkOrder, el precio queda congelado en ese registro. Los cambios posteriores en el catálogo de precios no afectan órdenes existentes. Esto es una regla de dominio, no una feature de UI.

---

### 8. El stock tiene tres estados, no uno

- `stock_fisico`: lo que hay físicamente.
- `stock_reservado`: lo que WorkOrders activas ya comprometieron.
- `stock_disponible` = `stock_fisico` - `stock_reservado`: lo que se puede vender.

Mostrar `stock_fisico` como stock disponible es un bug que genera sobreventa. Los usuarios ven siempre `stock_disponible`.

---

### 9. Los archivos no se borran

El soft delete de un recurso (Customer, Vehicle, WorkOrder) no elimina físicamente los archivos asociados en Cloudflare R2. La única excepción es la actualización del logo del Tenant.

Los archivos son evidencia legal. Una foto borrada de una orden cerrada puede ser el origen de un reclamo no resoluble.

---

### 10. Async first para operaciones costosas

El envío de mensajes WhatsApp, la generación de PDFs, la compresión de imágenes y los reintentos de subida a R2 se procesan en BullMQ. La respuesta HTTP al usuario no espera por estas operaciones.

---

### 11. Observabilidad no es opcional

Sentry captura excepciones en frontend y backend. Cada request tiene un `trace_id` propagado en todos los logs. Las slow queries (> 1000ms) se registran. Los errores de integración con servicios externos se capturan con contexto completo.

Sin observabilidad, el debugging en producción es adivinanza.

---

### 12. Auditoría inmutable por 2 años

Cada operación de escritura genera un registro de auditoría con el estado anterior y posterior del dato. Estos registros no pueden ser eliminados por ningún usuario del Tenant. Son la memoria del sistema.

---

## Decisiones de Dominio Permanentes

| Decisión | Valor |
|----------|-------|
| Expiración URLs pre-firmadas | 24 horas, todos los tipos |
| Precio de Part en WorkOrder | Congelado al momento de adición |
| Contador de visitas de Cliente | Solo WorkOrders en estado DELIVERED |
| Período por defecto en Dashboard | Mes en curso |
| Soft delete | Customers, Vehicles, WorkOrders — campo `deleted_at` |
| Eliminación física de archivos R2 | Solo logo del Tenant al actualizarlo |
| Stock mostrado al usuario | Siempre `stock_disponible` |
| Facturación DIAN | Abstracción `InvoiceProvider`, no implementada en Fase 1 |
| Idioma del sistema | Español latinoamericano |
