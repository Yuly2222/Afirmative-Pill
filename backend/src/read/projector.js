// PROYECTOR: construye el modelo de lectura `order_projections` a partir del
// modelo de escritura + el log de eventos, y avisa a los suscriptores.
//
// Corre FUERA de la transacción del comando y con un retraso configurable
// (PROJECTION_DELAY_MS) para hacer visible — y demostrable — la consistencia
// eventual entre "comando confirmado" y "proyección actualizada".
import { PubSub } from 'graphql-subscriptions';
import { sql } from '../db.js';
import { ORDER_COLUMNS } from './queries.js';

// ponytail: PubSub en memoria = una sola instancia del backend. Con varias
// réplicas, cambiar por Redis PubSub o Postgres LISTEN/NOTIFY.
export const pubsub = new PubSub();
export const ORDER_UPDATED = 'ORDER_UPDATED';

const DELAY_MS = Number(process.env.PROJECTION_DELAY_MS ?? 1500);

// Reconstruye la fila completa desde la fuente de verdad (idempotente): aplicar
// el mismo evento dos veces o en desorden deja el mismo resultado. El WHERE del
// ON CONFLICT descarta escrituras más viejas que la versión ya proyectada.
const UPSERT_PROJECTION = `
  insert into order_projections
    (id, status, total, item_count, requires_prescription, items, status_history,
     cancel_reason, created_at, updated_at, version)
  select o.id, o.status, o.total,
    (select coalesce(sum(oi.quantity), 0) from order_items oi where oi.order_id = o.id),
    o.requires_prescription,
    (select coalesce(jsonb_agg(jsonb_build_object(
        'medicationId', m.id, 'medicationName', m.commercial_name, 'presentation', m.presentation,
        'quantity', oi.quantity, 'unitPrice', oi.unit_price) order by m.commercial_name), '[]')
     from order_items oi join medications m on m.id = oi.medication_id where oi.order_id = o.id),
    (select coalesce(jsonb_agg(jsonb_build_object(
        'status', e.payload->>'status', 'at', e.created_at, 'note', e.payload->>'note') order by e.id), '[]')
     from domain_events e where e.aggregate_id = o.id),
    o.cancel_reason, o.created_at, o.updated_at,
    (select max(e.id) from domain_events e where e.aggregate_id = o.id)
  from orders o
  where o.id = $1
  on conflict (id) do update set
    status = excluded.status, total = excluded.total, item_count = excluded.item_count,
    items = excluded.items, status_history = excluded.status_history,
    cancel_reason = excluded.cancel_reason, updated_at = excluded.updated_at, version = excluded.version
  where order_projections.version < excluded.version
  returning ${ORDER_COLUMNS}`;

export async function projectOrder(orderId) {
  const [projection] = await sql(UPSERT_PROJECTION, [orderId]);
  if (!projection) return; // ya estaba al día
  console.log(`[Projector] order_projections ← orden ${orderId} estado=${projection.status} v${projection.version}`);
  await pubsub.publish(ORDER_UPDATED, { orderUpdated: projection });
}

/** Llamado por los comandos después del COMMIT. */
export function scheduleProjection(orderId) {
  setTimeout(() => projectOrder(orderId).catch((err) => console.error('[Projector] error', err)), DELAY_MS);
}

/**
 * Recuperación al arrancar: si el proceso murió entre el COMMIT de un comando y
 * su proyección, el log de eventos lo delata (evento más nuevo que la versión
 * proyectada) y se reproyecta.
 */
export async function catchUpProjections() {
  const stale = await sql(`
    select e.aggregate_id as id
    from domain_events e left join order_projections p on p.id = e.aggregate_id
    group by e.aggregate_id, p.version
    having max(e.id) > coalesce(p.version, 0)`);
  for (const { id } of stale) await projectOrder(id);
  if (stale.length) console.log(`[Projector] ${stale.length} proyecciones recuperadas al arrancar`);
}
