// LADO DE ESCRITURA (CQRS write side).
// Cada función es un comando que expresa una intención de negocio, se ejecuta en
// UNA transacción, protege las invariantes farmacéuticas y deja constancia en
// `domain_events`. Después del COMMIT se agenda la proyección (lado de lectura).
import { transaction, sql, toIntId, isUuid } from '../db.js';
import { scheduleProjection } from '../read/projector.js';

const PAYMENT_DELAY_MS = Number(process.env.PAYMENT_DELAY_MS ?? 4000);
const PRESCRIPTION_MAX_AGE_DAYS = 30;

/** Error de negocio esperado: viaja en `payload.errors`, no como error GraphQL. */
export class DomainError extends Error {
  constructor(errors) {
    super(errors.map((e) => e.message).join('; '));
    this.errors = errors;
  }
}
const error = (code, message, extra = {}) => ({ code, message, field: null, medicationId: null, ...extra });
const fail = (...args) => { throw new DomainError([error(...args)]); };

/** Convierte DomainError en payload `{ errors }`; cualquier otro error es un fallo real y se propaga. */
async function run(command) {
  try {
    return { ...(await command()), errors: [] };
  } catch (err) {
    if (err instanceof DomainError) return { errors: err.errors };
    throw err;
  }
}

const appendEvent = (q, orderId, type, payload) =>
  q('insert into domain_events (aggregate_id, type, payload) values ($1, $2, $3) returning id', [orderId, type, payload]);

// ---------------------------------------------------------------------------
// Carrito
// ---------------------------------------------------------------------------

export const createCart = () =>
  run(async () => {
    const [cart] = await sql('insert into carts default values returning id, status');
    return { cart };
  });

async function lockOpenCart(q, cartId) {
  if (!isUuid(cartId)) fail('CART_NOT_FOUND', 'El carrito no existe', { field: ['input', 'cartId'] });
  const [cart] = await q('select id, status from carts where id = $1 for update', [cartId]);
  if (!cart) fail('CART_NOT_FOUND', 'El carrito no existe', { field: ['input', 'cartId'] });
  if (cart.status !== 'OPEN') fail('CART_ALREADY_CHECKED_OUT', 'El carrito ya fue convertido en orden');
  return cart;
}

export const addToCart = ({ cartId, medicationId, quantity }) =>
  run(() => transaction(async (q) => {
    const cart = await lockOpenCart(q, cartId);
    const id = toIntId(medicationId);
    const [med] = id ? await q('select commercial_name as name, stock from medications where id = $1', [id]) : [];
    if (!med) fail('MEDICATION_NOT_FOUND', 'El medicamento no existe', { field: ['input', 'medicationId'] });

    const [current] = await q('select quantity from cart_items where cart_id = $1 and medication_id = $2', [cartId, id]);
    const wanted = (current?.quantity ?? 0) + quantity;
    // Chequeo temprano para buena UX. La reserva REAL y atómica ocurre en placeOrder.
    if (wanted > med.stock) {
      fail('OUT_OF_STOCK', `${med.name}: solo hay ${med.stock} unidades disponibles`, { medicationId: String(id), field: ['input', 'quantity'] });
    }
    await q(
      `insert into cart_items (cart_id, medication_id, quantity) values ($1, $2, $3)
       on conflict (cart_id, medication_id) do update set quantity = $3`,
      [cartId, id, wanted],
    );
    await q('update carts set updated_at = now() where id = $1', [cartId]);
    return { cart };
  }));

export const removeFromCart = ({ cartId, medicationId }) =>
  run(() => transaction(async (q) => {
    const cart = await lockOpenCart(q, cartId);
    await q('delete from cart_items where cart_id = $1 and medication_id = $2', [cartId, toIntId(medicationId)]);
    await q('update carts set updated_at = now() where id = $1', [cartId]);
    return { cart };
  }));

// ---------------------------------------------------------------------------
// Orden
// ---------------------------------------------------------------------------

function validatePrescription(p) {
  const errors = [];
  const bad = (field, message) => errors.push(error('INVALID_PRESCRIPTION', message, { field: ['input', 'prescription', field] }));
  if (p.doctorName.trim().length < 3) bad('doctorName', 'Nombre del médico incompleto');
  if (!/^[A-Za-z0-9-]{4,20}$/.test(p.doctorLicense)) bad('doctorLicense', 'Registro médico inválido (4-20 caracteres alfanuméricos o guiones)');
  if (!/^\d{5,12}$/.test(p.patientDocument)) bad('patientDocument', 'Documento del paciente inválido (5 a 12 dígitos)');
  const ageDays = (Date.now() - p.issuedAt.getTime()) / 86_400_000;
  if (ageDays < -1) bad('issuedAt', 'La fórmula no puede tener fecha futura');
  if (ageDays > PRESCRIPTION_MAX_AGE_DAYS) bad('issuedAt', `La fórmula está vencida (más de ${PRESCRIPTION_MAX_AGE_DAYS} días)`);
  return errors;
}

/**
 * PlaceOrder: convierte el carrito en orden reservando inventario.
 * Invariantes: carrito abierto y no vacío · stock suficiente para CADA ítem ·
 * fórmula médica válida si algún ítem la exige · un carrito = una orden.
 */
export async function placeOrder({ cartId, prescription }) {
  const result = await run(() => transaction(async (q) => {
    await lockOpenCart(q, cartId);

    // FOR UPDATE OF m bloquea las filas de inventario de estos medicamentos
    // (en orden de id → sin deadlocks) hasta el COMMIT. Dos pacientes comprando
    // la última unidad a la vez se serializan aquí: uno gana, el otro ve OUT_OF_STOCK.
    const items = await q(
      `select ci.medication_id as "medicationId", ci.quantity, m.commercial_name as name,
              m.price, m.stock, m.requires_prescription as "requiresPrescription"
       from cart_items ci join medications m on m.id = ci.medication_id
       where ci.cart_id = $1
       order by ci.medication_id
       for update of m`,
      [cartId],
    );
    if (!items.length) fail('EMPTY_CART', 'El carrito está vacío');

    // Se acumulan TODOS los errores para que el paciente los corrija de una vez.
    const errors = [];
    for (const it of items) {
      if (it.quantity > it.stock) {
        errors.push(error('OUT_OF_STOCK', `${it.name}: pediste ${it.quantity}, hay ${it.stock} disponibles`, { medicationId: String(it.medicationId) }));
      }
    }
    const rxItems = items.filter((it) => it.requiresPrescription);
    if (rxItems.length && !prescription) {
      for (const it of rxItems) {
        errors.push(error('PRESCRIPTION_REQUIRED', `${it.name} requiere fórmula médica`, { medicationId: String(it.medicationId), field: ['input', 'prescription'] }));
      }
    }
    if (rxItems.length && prescription) errors.push(...validatePrescription(prescription));
    if (errors.length) throw new DomainError(errors); // ROLLBACK: nada cambió

    const ids = items.map((it) => it.medicationId);
    const qtys = items.map((it) => it.quantity);
    const prices = items.map((it) => it.price);
    const total = items.reduce((sum, it) => sum + it.price * it.quantity, 0);

    // Reserva de inventario en una sola sentencia. El CHECK (stock >= 0) de la
    // tabla es la última red de seguridad si alguna validación fallara.
    await q(
      `update medications m set stock = m.stock - u.qty
       from unnest($1::int[], $2::int[]) as u(id, qty) where m.id = u.id`,
      [ids, qtys],
    );
    const [order] = await q(
      `insert into orders (cart_id, total, requires_prescription) values ($1, $2, $3)
       returning id, status, created_at as "createdAt"`,
      [cartId, total, rxItems.length > 0],
    );
    await q(
      `insert into order_items (order_id, medication_id, quantity, unit_price)
       select $1, * from unnest($2::int[], $3::int[], $4::numeric[])`,
      [order.id, ids, qtys, prices],
    );
    if (rxItems.length) {
      await q(
        `insert into prescriptions (order_id, doctor_name, doctor_license, patient_document, issued_at, notes)
         values ($1, $2, $3, $4, $5, $6)`,
        [order.id, prescription.doctorName.trim(), prescription.doctorLicense, prescription.patientDocument, prescription.issuedAt, prescription.notes ?? null],
      );
    }
    await q("update carts set status = 'CHECKED_OUT', updated_at = now() where id = $1", [cartId]);
    await appendEvent(q, order.id, 'OrderPlaced', {
      status: 'PENDING_APPROVAL',
      note: rxItems.length ? 'Pedido recibido. Esperando validación de la fórmula médica.' : 'Pedido recibido. Esperando confirmación del pago.',
    });

    return { orderId: order.id, status: order.status, acceptedAt: order.createdAt, requiresPrescription: rxItems.length > 0 };
  }));

  if (result.orderId) {
    scheduleProjection(result.orderId);
    // Simulación de pasarela de pago asíncrona para órdenes sin fórmula.
    if (!result.requiresPrescription) {
      setTimeout(() => {
        changeStatus(result.orderId, 'APPROVED', { event: 'PaymentConfirmed', note: 'Pago confirmado por la pasarela.' })
          .then((r) => r.errors.length && console.log(`[Payment] orden ${result.orderId} no aprobada: ${r.errors[0].message}`))
          .catch((err) => console.error('[Payment] error', err));
      }, PAYMENT_DELAY_MS);
    }
  }
  return result;
}

// Máquina de estados de la orden. Cualquier transición fuera de esta tabla es rechazada.
const TRANSITIONS = {
  PENDING_APPROVAL: ['APPROVED', 'CANCELLED'],
  APPROVED: ['DISPATCHED', 'CANCELLED'],
  DISPATCHED: [],
  CANCELLED: [],
};

async function changeStatus(orderId, to, { event, note, cancelReason = null, guard }) {
  const result = await run(() => transaction(async (q) => {
    if (!isUuid(orderId)) fail('ORDER_NOT_FOUND', 'La orden no existe');
    const [order] = await q('select id, status, requires_prescription as "requiresPrescription" from orders where id = $1 for update', [orderId]);
    if (!order) fail('ORDER_NOT_FOUND', 'La orden no existe');
    if (!TRANSITIONS[order.status].includes(to)) {
      fail('INVALID_STATE_TRANSITION', `No se puede pasar de ${order.status} a ${to}`);
    }
    // Invariante central: una orden con medicamentos formulados SOLO se aprueba
    // si un farmacéutico validó la fórmula (nunca por el pago automático).
    if (to === 'APPROVED' && order.requiresPrescription && event !== 'PrescriptionApproved') {
      fail('PRESCRIPTION_REQUIRED', 'La orden requiere validación de fórmula médica antes de aprobarse');
    }
    await guard?.(order, q);
    if (to === 'CANCELLED') {
      // Devolver a bodega lo reservado.
      await q(
        `update medications m set stock = m.stock + oi.quantity
         from order_items oi where oi.order_id = $1 and m.id = oi.medication_id`,
        [orderId],
      );
    }
    await q('update orders set status = $2, cancel_reason = $3, updated_at = now() where id = $1', [orderId, to, cancelReason]);
    await appendEvent(q, orderId, event, { status: to, note });
    return { orderId, status: to };
  }));
  if (result.orderId) scheduleProjection(result.orderId);
  return result;
}

export const reviewPrescription = ({ orderId, approved, notes }) =>
  changeStatus(orderId, approved ? 'APPROVED' : 'CANCELLED', {
    event: approved ? 'PrescriptionApproved' : 'PrescriptionRejected',
    note: notes || (approved ? 'Fórmula médica validada por el químico farmacéutico.' : 'Fórmula médica rechazada.'),
    cancelReason: approved ? null : `Fórmula rechazada: ${notes || 'sin observaciones'}`,
    async guard(order, q) {
      if (!order.requiresPrescription) fail('INVALID_STATE_TRANSITION', 'Esta orden no contiene medicamentos formulados');
      await q('update prescriptions set review_notes = $2, reviewed_at = now() where order_id = $1', [orderId, notes ?? null]);
    },
  });

export const dispatchOrder = ({ orderId }) =>
  changeStatus(orderId, 'DISPATCHED', { event: 'OrderDispatched', note: 'Entregado al operador logístico.' });

export function cancelOrder({ orderId, reason }) {
  if (!reason.trim()) return { errors: [error('VALIDATION_ERROR', 'Debe indicar el motivo de cancelación', { field: ['input', 'reason'] })] };
  return changeStatus(orderId, 'CANCELLED', { event: 'OrderCancelled', note: reason.trim(), cancelReason: reason.trim() });
}
