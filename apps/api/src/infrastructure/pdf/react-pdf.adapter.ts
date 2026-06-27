import { Injectable } from '@nestjs/common';
import { createElement } from 'react';
import {
  PdfGeneratorPort,
  QuotePdfData,
  QuotePdfLine,
  SaleContractPdfData,
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

  async generateSaleContractPdf(data: SaleContractPdfData): Promise<Buffer> {
    const { Document, Page, Text, View, StyleSheet, renderToBuffer } = (await dynamicImport(
      '@react-pdf/renderer',
    )) as typeof import('@react-pdf/renderer');

    const s = StyleSheet.create({
      page: { padding: 36, fontSize: 10, color: '#1f2937', lineHeight: 1.4 },
      h1: { fontSize: 16, fontWeight: 'bold', textAlign: 'center', marginBottom: 2 },
      sub: { fontSize: 10, color: '#6b7280', textAlign: 'center', marginBottom: 12 },
      muted: { color: '#6b7280' },
      section: { marginTop: 12 },
      sectionTitle: { fontSize: 11, fontWeight: 'bold', marginBottom: 4 },
      kv: { flexDirection: 'row', paddingVertical: 1 },
      k: { width: 130, color: '#6b7280' },
      v: { flex: 1 },
      totalRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 3 },
      totalLabel: { width: 140, textAlign: 'right', marginRight: 8 },
      totalValue: { width: 100, textAlign: 'right' },
      grand: { fontSize: 12, fontWeight: 'bold' },
      signRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 48 },
      signBox: { width: '45%', borderTop: '1px solid #1f2937', paddingTop: 4, textAlign: 'center' },
    });

    const kv = (k: string, v: string) =>
      h(View, { style: s.kv }, [
        h(Text, { key: 'k', style: s.k }, k),
        h(Text, { key: 'v', style: s.v }, v),
      ]);

    const totalLine = (label: string, value: string, grand = false) =>
      h(View, { style: s.totalRow }, [
        h(Text, { key: 'l', style: [s.totalLabel, ...(grand ? [s.grand] : [])] }, label),
        h(Text, { key: 'v', style: [s.totalValue, ...(grand ? [s.grand] : [])] }, value),
      ]);

    const m = data.motorcycle;
    const condition = m.condition === 'NEW' ? 'Nueva' : 'Usada';
    const payment =
      data.paymentMethod === 'FINANCED'
        ? `Financiado — cuota inicial ${money(data.downPayment)}, ${data.financingMonths ?? 0} meses`
        : 'Contado';

    const doc = h(
      Document,
      {},
      h(Page, { size: 'A4', style: s.page }, [
        h(View, { key: 'hdr' }, [
          h(Text, { key: 'name', style: s.h1 }, data.tenant.name),
          h(
            Text,
            { key: 'tax', style: s.sub },
            `NIT ${data.tenant.taxId}${data.tenant.address ? ` · ${data.tenant.address}` : ''}${data.tenant.phone ? ` · ${data.tenant.phone}` : ''}`,
          ),
        ]),
        h(Text, { key: 'title', style: s.h1 }, 'Contrato de Compraventa de Motocicleta'),
        h(
          Text,
          { key: 'no', style: s.sub },
          `N° ${data.orderNumber} · ${data.issuedAt.toLocaleDateString('es-CO')}`,
        ),
        h(View, { key: 'parts', style: s.section }, [
          h(Text, { key: 't', style: s.sectionTitle }, 'Partes'),
          kv('Vendedor', `${data.tenant.name} (NIT ${data.tenant.taxId})`),
          kv(
            'Comprador',
            `${data.customer.fullName} (${data.customer.documentType} ${data.customer.documentNumber})`,
          ),
          kv('Teléfono', data.customer.phone),
          kv(
            'Dirección',
            `${data.customer.address ? `${data.customer.address}, ` : ''}${data.customer.city}`,
          ),
        ]),
        h(View, { key: 'moto', style: s.section }, [
          h(Text, { key: 't', style: s.sectionTitle }, 'Vehículo objeto de la venta'),
          kv('Marca / Modelo', `${m.brand} ${m.model}`),
          kv('Año', String(m.year)),
          kv('Condición', `${condition}${m.condition === 'USED' ? ` · ${m.mileage} km` : ''}`),
          kv('VIN / Chasis', m.vin),
          m.engineNumber ? kv('N° de motor', m.engineNumber) : null,
          m.plate ? kv('Placa', m.plate) : null,
          m.color ? kv('Color', m.color) : null,
        ]),
        h(View, { key: 'price', style: s.section }, [
          h(Text, { key: 't', style: s.sectionTitle }, 'Condiciones económicas'),
          totalLine('Precio', money(data.salePrice)),
          totalLine('Descuento', money(data.discount)),
          totalLine('Total', money(data.totalAmount), true),
          kv('Forma de pago', payment),
        ]),
        h(View, { key: 'decl', style: s.section }, [
          h(
            Text,
            { key: 'd', style: s.muted },
            'El vendedor declara que la motocicleta descrita es de su propiedad y se ' +
              'encuentra libre de gravámenes. El comprador la recibe a satisfacción. ' +
              'Las partes firman en señal de conformidad.',
          ),
        ]),
        h(View, { key: 'sign', style: s.signRow }, [
          h(View, { key: 'v', style: s.signBox }, [
            h(Text, { key: 'a', style: s.muted }, 'Vendedor'),
            h(Text, { key: 'b' }, data.tenant.name),
          ]),
          h(View, { key: 'c', style: s.signBox }, [
            h(Text, { key: 'a', style: s.muted }, 'Comprador'),
            h(Text, { key: 'b' }, data.customer.fullName),
          ]),
        ]),
      ]),
    );

    return renderToBuffer(doc as Parameters<typeof renderToBuffer>[0]);
  }
}
