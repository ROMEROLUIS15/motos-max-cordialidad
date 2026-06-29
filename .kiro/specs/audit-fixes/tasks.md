# Audit Fixes — Tasks

> Ejecutar en orden. No pasar a la siguiente fase hasta que el verificador humano apruebe la anterior.
> Referencia completa: `requirements.md`

---

## FASE 1 — Seguridad crítica

- [x] 1. **F1-1** — Restringir CORS en `apps/api/src/main.ts`: leer `ALLOWED_ORIGINS` del entorno y pasar `{ origin }` a `enableCors()`. Permisivo solo cuando `NODE_ENV !== 'production'`.

- [x] 2. **F1-2** — `apps/api/src/infrastructure/auth/jwt.service.ts`: lanzar `Error` si `JWT_SECRET` falta en producción; `console.warn` en desarrollo.

- [x] 3. **F1-3** — `apps/api/src/infrastructure/crypto/field-encryption.service.ts`: mismo patrón que F1-2 para `ENCRYPTION_KEY`.

- [x] 4. **F1-4** — `apps/api/src/presentation/http/controllers/tenants.controller.ts`: agregar `@UseGuards(ThrottlerGuard)` y `@Throttle({ default: { limit: 3, ttl: 300000 } })` en el endpoint `@Post()`.

- [x] 5. **F1-5** — `apps/api/src/presentation/http/controllers/auth.controller.ts`: agregar `@UseGuards(ThrottlerGuard)` y `@Throttle({ default: { limit: 10, ttl: 60000 } })` en `@Post('refresh')`.

- [x] 6. **F1-6** — `apps/api/src/app.module.ts`: agregar `{ provide: APP_GUARD, useClass: ThrottlerGuard }` en providers. Actualizar `ThrottlerModule.forRoot` a `[{ ttl: 60000, limit: 60 }]`. Importar `ThrottlerGuard` y `APP_GUARD`.

- [x] 7. **F1-7** — `apps/api/src/infrastructure/persistence/prisma/repositories/work-order.prisma-repository.ts`: reemplazar la implementación de `generateOrderNumber` con la query atómica de `MAX + 1` especificada en requirements.

- [x] 8. **F1-8** — `apps/api/src/presentation/http/guards/permission.guard.ts`: reducir `TTL_MS` de `5 * 60 * 1000` a `30 * 1000`. Agregar comentario que documente la limitación de in-memory caché en multi-réplica.

> **CHECKPOINT FASE 1**: Ejecutar `pnpm --filter @motoworkshop/api typecheck` y verificar que el servidor arranca correctamente.

---

## FASE 2 — Rendimiento y UX

- [x] 9. **F2-1** — `apps/web/src/app/(dashboard)/work-orders/[id]/page.tsx`: mover la llamada a `useTeam()` al componente padre `WorkOrderDetailPage` (ya existe en línea 72, no duplicar). Pasar `technicians` y `nameOf` como props a `ServiceLinesSection`. Eliminar la llamada a `useTeam()` dentro de `ServiceLinesSection` (línea 522). Actualizar la definición de props de `ServiceLinesSection`.

- [x] 10. **F2-2** — `apps/web/src/components/dashboard-shell.tsx`: en el componente `Brand`, eliminar `pathname` del array de dependencias del `useEffect`. Eliminar `const pathname = usePathname()` si `pathname` ya no se usa en ningún otro lugar de `Brand`.

- [x] 11. **F2-3** — `apps/web/src/app/(dashboard)/work-orders/[id]/page.tsx`: reemplazar `window.prompt()` con un inline form en `TransitionButton` (o un Modal). Cuando `next === 'COMPLETED'`, mostrar un input de odómetro + botones Confirmar/Cancelar antes de disparar el callback `onClick`. El componente `TransitionButton` puede manejar su propio estado local `[showInput, setShowInput]`.

- [x] 11b. **F2-3b** — Revisar si el `Modal` de `@/components/ui/modal` es más apropiado que el inline form y usarlo si simplifica la implementación. En cualquier caso, no usar `window.prompt`.

- [x] 12. **F2-4** — `apps/web/src/app/(dashboard)/work-orders/[id]/page.tsx`: en `QuotesSection` (línea ~908) y `PaymentsSection` (línea ~1022), cambiar `useEffect(() => load(), [load])` a `useEffect(() => { void load(); }, [load])`.

- [x] 13. **F2-5** — `apps/api/src/presentation/http/controllers/work-orders.controller.ts`: agregar función helper `parseDate` local y aplicarla a los parámetros `from` y `to`. Importar `BadRequestException`.

> **CHECKPOINT FASE 2**: Ejecutar `pnpm --filter @motoworkshop/web typecheck`. Verificar manualmente que abrir una orden de trabajo en el browser genera exactamente 7 requests HTTP (no 9) en el Network tab.

---

## FASE 3 — Refactor estructural

- [x] 14. **F3-1** — Crear directorio `apps/web/src/app/(dashboard)/work-orders/[id]/_components/`. Extraer los 10 sub-componentes a sus archivos individuales (ver lista en requirements F3-1). Actualizar `page.tsx` para importarlos. Verificar que `page.tsx` resultante tiene menos de 150 líneas, mantiene `'use client'` y `export const runtime = 'edge'`.

- [x] 15. **F3-2** — Crear los 11 archivos de use-case individuales en `apps/api/src/application/use-cases/agents/`. Actualizar `apps/api/src/agents.module.ts` y todos los demás importadores. Convertir `agents.use-cases.ts` en un barrel `index.ts` que re-exporte todo (para no romper imports externos inesperados), o eliminarlo si no hay otros importadores fuera del módulo.

- [x] 16. **F3-3** — Crear `apps/api/src/presentation/http/dtos/update-tenant-config.dto.ts` con el DTO tipado. Actualizar `tenants.controller.ts` para usarlo en el `@Body()`.

- [x] 17. **F3-4** — `apps/api/src/infrastructure/persistence/prisma/repositories/work-order.prisma-repository.ts`: reemplazar los tres `as unknown as string[]` (líneas 238, 253, 338) con `as string[]` directo. Verificar que TypeScript no lanza error después del cambio.

- [x] 18. **F3-5** — `apps/web/src/components/dashboard-shell.tsx`: eliminar el bloque del botón de búsqueda decorativo (líneas 258-266). Eliminar `Search` de los imports de `lucide-react` si queda sin usar.

> **CHECKPOINT FASE 3**: Ejecutar `pnpm typecheck` (global, todas las apps). Corregir cualquier error antes de marcar fase completada.

---

## Verificación final

- [x] 19. Ejecutar `pnpm lint` en la raíz. Sin errores nuevos.
- [x] 20. Ejecutar `pnpm --filter @motoworkshop/api test` (unit tests). Sin regresiones.
- [x] 21. Ejecutar `pnpm --filter @motoworkshop/web test` (vitest). Sin regresiones.
- [x] 22. Confirmar que `pnpm --filter @motoworkshop/api build` y `pnpm --filter @motoworkshop/web build` terminan sin errores.
