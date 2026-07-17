/**
 * Gate de latencia (no prueba de carga).
 *
 * Este taller tiene ~7 usuarios: preguntarle al sistema si aguanta 500 VUs no
 * responde ninguna pregunta real. Lo que sí importa es si los endpoints siguen
 * respondiendo rápido cuando los datos crecen, así que esto corre con la
 * concurrencia real (4 VUs) contra una BD sembrada con volumen (20k órdenes) y
 * falla si algún endpoint se sale de su presupuesto de latencia.
 *
 * Requiere: API local apuntando a motoworkshop_perf (ver perf/README.md).
 *   k6 run perf/latency.k6.js
 */
import http from 'k6/http';
import { check, fail } from 'k6';
import { Trend } from 'k6/metrics';

const BASE = __ENV.BASE_URL || 'http://localhost:3001';
const EMAIL = __ENV.PERF_EMAIL || 'owner@demo.com';
const PASSWORD = __ENV.PERF_PASSWORD || 'Demo1234!';

// Una métrica por endpoint: un p95 global escondería al lento detrás de los rápidos.
const listOrders = new Trend('ep_list_orders', true);
const searchOrders = new Trend('ep_search_orders', true);
const orderDetail = new Trend('ep_order_detail', true);
const listCustomers = new Trend('ep_list_customers', true);
const dashboard = new Trend('ep_dashboard', true);

export const options = {
  scenarios: {
    uso_real: {
      executor: 'constant-vus',
      vus: 4, // el taller entero: dueño, recepción y un par de técnicos
      duration: '30s',
    },
  },
  thresholds: {
    // Presupuestos deliberados: son objetivos de UX, no lo que hoy mide la máquina.
    ep_list_orders: ['p(95)<400'],
    ep_search_orders: ['p(95)<600'], // búsqueda ILIKE: la sospechosa
    ep_order_detail: ['p(95)<400'],
    ep_list_customers: ['p(95)<400'],
    ep_dashboard: ['p(95)<800'], // agrega varias consultas
    http_req_failed: ['rate<0.01'],
  },
};

export function setup() {
  const res = http.post(
    `${BASE}/api/auth/login`,
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  if (res.status !== 200) {
    fail(`login falló (${res.status}): ${res.body}`);
  }
  const token = res.json('accessToken');

  // Un id real para el detalle: sin esto mediríamos el 404, que es rápido y miente.
  const list = http.get(`${BASE}/api/work-orders?page=1&pageSize=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const items = list.json('items');
  if (!items || items.length === 0) {
    fail('la BD no tiene órdenes: siembra volumen antes (perf/README.md)');
  }
  return { token, orderId: items[0].id };
}

export default function (data) {
  const params = { headers: { Authorization: `Bearer ${data.token}` } };

  const r1 = http.get(`${BASE}/api/work-orders?page=1&pageSize=20`, params);
  listOrders.add(r1.timings.duration);
  check(r1, { 'listado de órdenes 200': (r) => r.status === 200 });

  // Término parcial y en minúsculas: fuerza el ILIKE '%...%' sobre los joins.
  const r2 = http.get(`${BASE}/api/work-orders?page=1&pageSize=20&search=perez`, params);
  searchOrders.add(r2.timings.duration);
  check(r2, { 'búsqueda de órdenes 200': (r) => r.status === 200 });

  const r3 = http.get(`${BASE}/api/work-orders/${data.orderId}`, params);
  orderDetail.add(r3.timings.duration);
  check(r3, { 'detalle de orden 200': (r) => r.status === 200 });

  const r4 = http.get(`${BASE}/api/customers?page=1&pageSize=20`, params);
  listCustomers.add(r4.timings.duration);
  check(r4, { 'listado de clientes 200': (r) => r.status === 200 });

  const r5 = http.get(`${BASE}/api/dashboard/summary`, params);
  dashboard.add(r5.timings.duration);
  check(r5, { 'dashboard 200': (r) => r.status === 200 });
}
