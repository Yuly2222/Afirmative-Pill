// Prueba de extremo a extremo contra la BD configurada en DATABASE_URL.
// Levanta el servidor real en el puerto 4100 y habla SOLO GraphQL (HTTP + WS).
// Las órdenes creadas se cancelan (devuelven stock), salvo una de Losartán que termina DISPATCHED.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createClient } from 'graphql-ws';
import WebSocket from 'ws';

const PORT = 4100;
const URL = `http://localhost:${PORT}/graphql`;
let server;

before(async () => {
  server = spawn(process.execPath, ['src/index.js'], {
    env: { ...process.env, PORT: String(PORT), PROJECTION_DELAY_MS: '300', PAYMENT_DELAY_MS: '800', LOG_SQL: 'false' },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise((resolve) => server.stdout.on('data', (d) => d.toString().includes('/graphql') && resolve()));
});
after(() => server.kill());

async function gql(query, variables = {}) {
  const res = await fetch(URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query, variables }) });
  const body = await res.json();
  assert.equal(body.errors, undefined, JSON.stringify(body.errors));
  return body.data;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitForOrder(id, status) {
  for (let i = 0; i < 40; i++) {
    const { order } = await gql('query($id: ID!) { order(id: $id) { id status total itemCount statusHistory { status } items { medicationName quantity subtotal } } }', { id });
    if (order && (!status || order.status === status)) return order;
    await sleep(100);
  }
  throw new Error(`La proyección de ${id} no llegó a ${status}`);
}

const med = async (search) => (await gql('query($s: String) { medications(filter: { search: $s }, first: 1) { nodes { id availableUnits } } }', { s: search })).medications.nodes[0];
const newCart = async () => (await gql('mutation { createCart { cart { id } errors { code } } }')).createCart.cart.id;
const add = (cartId, medicationId, quantity) => gql(
  'mutation($i: AddToCartInput!) { addToCart(input: $i) { cart { itemCount total requiresPrescription } errors { code message medicationId } } }',
  { i: { cartId, medicationId, quantity } }).then((d) => d.addToCart);
const place = (cartId, prescription) => gql(
  'mutation($i: PlaceOrderInput!) { placeOrder(input: $i) { orderId status acceptedAt errors { code message field medicationId } } }',
  { i: { cartId, prescription } }).then((d) => d.placeOrder);
const cancel = (orderId) => gql('mutation($i: CancelOrderInput!) { cancelOrder(input: $i) { status errors { code } } }', { i: { orderId, reason: 'limpieza de test' } }).then((d) => d.cancelOrder);
const validRx = () => ({ doctorName: 'Dra. Ana Pérez', doctorLicense: 'RM-123456', patientDocument: '1020304050', issuedAt: new Date().toISOString() });

test('OTC: la orden nace PENDING_APPROVAL, la proyección llega después y el pago la aprueba', async () => {
  const dolex = await med('Dolex');
  const cartId = await newCart();
  assert.deepEqual((await add(cartId, dolex.id, 2)).errors, []);

  const ack = await place(cartId);
  assert.deepEqual(ack.errors, []);
  assert.equal(ack.status, 'PENDING_APPROVAL');
  // Consistencia eventual: inmediatamente después del comando la proyección aún no existe.
  assert.equal((await gql('query($id: ID!) { order(id: $id) { id } }', { id: ack.orderId })).order, null);

  const pending = await waitForOrder(ack.orderId);
  assert.equal(pending.itemCount, 2);
  assert.equal(pending.total, 2 * 18900);
  const approved = await waitForOrder(ack.orderId, 'APPROVED');
  assert.deepEqual(approved.statusHistory.map((s) => s.status), ['PENDING_APPROVAL', 'APPROVED']);
  assert.equal((await med('Dolex')).availableUnits, dolex.availableUnits - 2);

  // Idempotencia: el mismo carrito no genera una segunda orden.
  assert.equal((await place(cartId)).errors[0].code, 'CART_ALREADY_CHECKED_OUT');
  await cancel(ack.orderId);
  assert.equal((await med('Dolex')).availableUnits, dolex.availableUnits);
});

test('Invariante: medicamento con fórmula no se ordena sin soporte, y el stock no se toca', async () => {
  const amox = await med('Amoxicilina');
  const cartId = await newCart();
  assert.equal((await add(cartId, amox.id, 1)).cart.requiresPrescription, true);

  const noRx = await place(cartId);
  assert.equal(noRx.orderId, null);
  assert.equal(noRx.errors[0].code, 'PRESCRIPTION_REQUIRED');
  assert.equal(noRx.errors[0].medicationId, amox.id);

  const badRx = await place(cartId, { ...validRx(), doctorLicense: '??', issuedAt: '2020-01-01T00:00:00Z' });
  assert.deepEqual(badRx.errors.map((e) => e.field.at(-1)).sort(), ['doctorLicense', 'issuedAt']);
  assert.equal((await med('Amoxicilina')).availableUnits, amox.availableUnits);
});

test('Invariante: no se vende un ítem agotado', async () => {
  const cefalexina = await med('Cefalexina');
  assert.equal(cefalexina.availableUnits, 0);
  const res = await add(await newCart(), cefalexina.id, 1);
  assert.equal(res.errors[0].code, 'OUT_OF_STOCK');
});

test('Concurrencia: dos pacientes compran las últimas unidades a la vez → solo uno gana', async () => {
  const januvia = await med('Januvia');
  const [a, b] = [await newCart(), await newCart()];
  await add(a, januvia.id, januvia.availableUnits);
  await add(b, januvia.id, januvia.availableUnits);
  const results = await Promise.all([place(a, validRx()), place(b, validRx())]);
  const winners = results.filter((r) => r.orderId);
  assert.equal(winners.length, 1);
  assert.equal(results.find((r) => !r.orderId).errors[0].code, 'OUT_OF_STOCK');
  assert.equal((await med('Januvia')).availableUnits, 0);
  await cancel(winners[0].orderId);
  assert.equal((await med('Januvia')).availableUnits, januvia.availableUnits);
});

test('Máquina de estados + Subscription: la fórmula se valida antes de despachar', async () => {
  const losartan = await med('Losartán');
  const cartId = await newCart();
  await add(cartId, losartan.id, 1);
  const { orderId } = await place(cartId, validRx());
  await waitForOrder(orderId, 'PENDING_APPROVAL');

  const ws = createClient({ url: URL.replace('http', 'ws'), webSocketImpl: WebSocket });
  const received = [];
  const done = new Promise((resolve, reject) => ws.subscribe(
    { query: 'subscription($id: ID) { orderUpdated(orderId: $id) { status version } }', variables: { id: orderId } },
    { next: ({ data }) => { received.push(data.orderUpdated.status); if (received.includes('DISPATCHED')) resolve(); }, error: reject, complete: () => {} },
  ));
  await sleep(200);

  const dispatchEarly = await gql('mutation($id: ID!) { dispatchOrder(orderId: $id) { errors { code } } }', { id: orderId });
  assert.equal(dispatchEarly.dispatchOrder.errors[0].code, 'INVALID_STATE_TRANSITION');

  const review = await gql('mutation($i: ReviewPrescriptionInput!) { reviewPrescription(input: $i) { status errors { code } } }', { i: { orderId, approved: true } });
  assert.equal(review.reviewPrescription.status, 'APPROVED');
  const dispatched = await gql('mutation($id: ID!) { dispatchOrder(orderId: $id) { status errors { code } } }', { id: orderId });
  assert.equal(dispatched.dispatchOrder.status, 'DISPATCHED');

  await done;
  // El proyector reconstruye desde la fuente de verdad: si dos comandos llegan casi juntos,
  // puede emitir solo el estado final. Lo que importa es converger, y el historial completo.
  assert.equal(received.at(-1), 'DISPATCHED');
  const final = await waitForOrder(orderId, 'DISPATCHED');
  assert.deepEqual(final.statusHistory.map((s) => s.status), ['PENDING_APPROVAL', 'APPROVED', 'DISPATCHED']);
  assert.equal((await cancel(orderId)).errors[0].code, 'INVALID_STATE_TRANSITION');
  await ws.dispose();
  // Nota: esta orden queda DISPATCHED (1 unidad de Losartán sale del inventario).
});
