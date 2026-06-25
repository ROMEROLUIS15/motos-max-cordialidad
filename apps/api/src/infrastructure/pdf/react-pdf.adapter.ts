import { Injectable } from '@nestjs/common';
import { createElement } from 'react';
import {
  PdfGeneratorPort,
  QuotePdfData,
  QuotePdfLine,
} from '../../application/ports/pdf-generator.port';

// @react-pdf/renderer's primitives don't satisfy React.createElement's strict
// component overloads; use a loose signature for building the document tree.
const h = createElement as (
  type: unknown,
  props?: Record<string, unknown> | null,
  ...children: unknown[]
) => ReturnType<typeof createElement>;

const money = (n: number) =>
  n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

// @react-pdf/renderer is ESM-only. Under a CommonJS build, TypeScript would
// downlevel `import()` to `require()` (which throws ERR_REQUIRE_ESM). The
// Function indirection keeps it a real dynamic import at runtime.
const dynamicImport = new Function('m', 'return import(m)') as (m: string) => Promise<unknown>;

/**
 * Generates the quote PDF synchronously within the request cycle using
 * @react-pdf/renderer. The library is ESM-only, so it is loaded with a dynamic
 * import() to stay compatible with the CommonJS build.
 */
@Injectable()
export class ReactPdfAdapter implements PdfGeneratorPort {
  async generateQuotePdf(data: QuotePdfData): Promise<Buffer> {
    const { Document, Page, Text, View, StyleSheet, renderToBuffer } = (await dynamicImport(
      '@react-pdf/renderer',
    )) as typeof import('@react-pdf/renderer');

    const s = StyleSheet.create({
      page: { padding: 32, fontSize: 10, color: '#1f2937' },
      h1: { fontSize: 18, fontWeight: 'bold', marginBottom: 2 },
      muted: { color: '#6b7280' },
      section: { marginTop: 14 },
      sectionTitle: { fontSize: 12, fontWeight: 'bold', marginBottom: 4 },
      row: { flexDirection: 'row', borderBottom: '1px solid #e5e7eb', paddingVertical: 3 },
      cellDesc: { flex: 3 },
      cellNum: { flex: 1, textAlign: 'right' },
      totalRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 },
      totalLabel: { width: 120, textAlign: 'right', marginRight: 8 },
      totalValue: { width: 90, textAlign: 'right' },
      grand: { fontSize: 13, fontWeight: 'bold' },
    });

    const lineRows = (lines: QuotePdfLine[]) =>
      lines.map((l, i) =>
        h(View, { key: i, style: s.row }, [
          h(Text, { key: 'd', style: s.cellDesc }, l.description),
          h(Text, { key: 'q', style: s.cellNum }, String(l.quantity)),
          h(Text, { key: 'u', style: s.cellNum }, money(l.unitPrice)),
          h(Text, { key: 't', style: s.cellNum }, money(l.total)),
        ]),
      );

    const totalLine = (label: string, value: string, grand = false) =>
      h(View, { style: s.totalRow }, [
        h(Text, { key: 'l', style: [s.totalLabel, ...(grand ? [s.grand] : [])] }, label),
        h(Text, { key: 'v', style: [s.totalValue, ...(grand ? [s.grand] : [])] }, value),
      ]);

    const doc = h(
      Document,
      {},
      h(Page, { size: 'A4', style: s.page }, [
        h(View, { key: 'hdr' }, [
          h(Text, { key: 'name', style: s.h1 }, data.tenant.name),
          h(Text, { key: 'tax', style: s.muted }, `NIT: ${data.tenant.taxId}`),
          data.tenant.address
            ? h(Text, { key: 'addr', style: s.muted }, data.tenant.address)
            : null,
          data.tenant.phone ? h(Text, { key: 'ph', style: s.muted }, data.tenant.phone) : null,
        ]),
        h(View, { key: 'meta', style: s.section }, [
          h(Text, { key: 'qn', style: s.sectionTitle }, `Cotización ${data.quoteNumber}`),
          h(
            Text,
            { key: 'cust' },
            `Cliente: ${data.customer.fullName} (${data.customer.documentNumber})`,
          ),
          h(
            Text,
            { key: 'veh' },
            `Vehículo: ${data.vehicle.plate} — ${data.vehicle.brand} ${data.vehicle.model}`,
          ),
          h(
            Text,
            { key: 'valid', style: s.muted },
            `Válida hasta: ${data.validUntil.toLocaleDateString('es-CO')}`,
          ),
        ]),
        h(View, { key: 'svc', style: s.section }, [
          h(Text, { key: 'st', style: s.sectionTitle }, 'Servicios'),
          ...lineRows(data.services),
        ]),
        h(View, { key: 'prt', style: s.section }, [
          h(Text, { key: 'pt', style: s.sectionTitle }, 'Repuestos'),
          ...lineRows(data.parts),
        ]),
        h(View, { key: 'tot', style: s.section }, [
          totalLine('Subtotal', money(data.subtotal)),
          totalLine(`IVA (${data.vatPercentage}%)`, money(data.vatAmount)),
          totalLine('Total', money(data.total), true),
        ]),
        data.termsConditions
          ? h(View, { key: 'terms', style: s.section }, [
              h(Text, { key: 'tt', style: s.sectionTitle }, 'Términos y condiciones'),
              h(Text, { key: 'tc', style: s.muted }, data.termsConditions),
            ])
          : null,
      ]),
    );

    return renderToBuffer(doc as Parameters<typeof renderToBuffer>[0]);
  }
}
