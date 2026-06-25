'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { apiGet } from '@/lib/api';

interface DashboardSummary {
  activeByStatus: Record<string, number>;
  collectedToday: number;
  collectedMonth: number;
  avgCycleHours: number;
  lowStock: Array<{ partId: string; name: string; stockDisponible: number }>;
  lowStockCount: number;
  nearingDeadline: Array<{ id: string; orderNumber: string; promisedDeliveryAt: string; overdue: boolean }>;
  technicianRanking: Array<{ technicianId: string; technicianName: string; completed: number }>;
  incomeTrend: Array<{ date: string; total: number }>;
  topParts: Array<{ partId: string; name: string; totalQuantity: number }>;
  waitingPartsAlert: boolean;
  waitingPartsCount: number;
}

const money = (n: number) => n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = () =>
      apiGet<DashboardSummary>('/api/dashboard/summary')
        .then(setData)
        .catch((e) => setError((e as Error).message));
    void load();
    const t = setInterval(() => void load(), 60000); // poll every 60s
    return () => clearInterval(t);
  }, []);

  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (!data) return <div className="p-6 text-gray-500">Cargando dashboard...</div>;

  const activeTotal = Object.values(data.activeByStatus).reduce((a, b) => a + b, 0);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      {data.waitingPartsAlert && (
        <div className="bg-amber-100 border border-amber-300 text-amber-800 rounded-lg px-4 py-3 text-sm font-medium">
          ⚠ {data.waitingPartsCount} órdenes en espera de repuestos (umbral superado)
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label="Cobrado hoy" value={money(data.collectedToday)} />
        <Kpi label="Cobrado mes" value={money(data.collectedMonth)} />
        <Kpi label="Órdenes activas" value={String(activeTotal)} />
        <Kpi label="Ciclo promedio (h)" value={String(data.avgCycleHours)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Income trend chart */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Tendencia de ingresos (30 días)</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.incomeTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip formatter={(v) => money(Number(v))} />
                <Line type="monotone" dataKey="total" stroke="#2563eb" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Nearing deadline */}
        <div className="bg-white rounded-lg shadow p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Próximas a vencer</h2>
          <ul className="space-y-2 text-sm">
            {data.nearingDeadline.length === 0 && <li className="text-gray-400">Ninguna</li>}
            {data.nearingDeadline.map((o) => (
              <li key={o.id} className="flex justify-between">
                <Link href={`/work-orders/${o.id}`} className="text-blue-600 hover:underline">
                  {o.orderNumber}
                </Link>
                <span className={o.overdue ? 'text-red-600 font-semibold' : 'text-gray-500'}>
                  {new Date(o.promisedDeliveryAt).toLocaleString('es-CO')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Low stock */}
        <div className="bg-white rounded-lg shadow p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            Stock bajo {data.lowStockCount > 0 && <span className="text-red-600">({data.lowStockCount})</span>}
          </h2>
          <ul className="space-y-1 text-sm">
            {data.lowStock.length === 0 && <li className="text-gray-400">Sin alertas</li>}
            {data.lowStock.slice(0, 8).map((p) => (
              <li key={p.partId} className="flex justify-between">
                <span className="text-gray-700">{p.name}</span>
                <span className="text-red-600 font-medium">{p.stockDisponible}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Technician ranking */}
        <div className="bg-white rounded-lg shadow p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Top técnicos</h2>
          <ul className="space-y-1 text-sm">
            {data.technicianRanking.length === 0 && <li className="text-gray-400">Sin datos</li>}
            {data.technicianRanking.map((t, i) => (
              <li key={t.technicianId} className="flex justify-between">
                <span className="text-gray-700">
                  {i + 1}. {t.technicianName}
                </span>
                <span className="text-gray-900 font-medium">{t.completed}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Top parts */}
        <div className="bg-white rounded-lg shadow p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Top repuestos</h2>
          <ul className="space-y-1 text-sm">
            {data.topParts.length === 0 && <li className="text-gray-400">Sin datos</li>}
            {data.topParts.map((p) => (
              <li key={p.partId} className="flex justify-between">
                <span className="text-gray-700">{p.name}</span>
                <span className="text-gray-900 font-medium">{p.totalQuantity}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
