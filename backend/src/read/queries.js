// LADO DE LECTURA (CQRS read side).
// Solo SELECTs. Nunca modifica estado. Las órdenes se leen de la proyección
// `order_projections`, nunca de las tablas transaccionales `orders`/`order_items`.
import { GraphQLError } from 'graphql';
import { sql, toIntId, isUuid } from '../db.js';

export const MEDICATION_COLUMNS = `
  m.id, m.commercial_name as "commercialName", m.active_ingredient as "activeIngredient",
  m.concentration, m.presentation, m.price, m.stock,
  m.requires_prescription as "requiresPrescription", m.indications, m.contraindications,
  m.laboratory_id as "laboratoryId", m.category_id as "categoryId"`;

export const ORDER_COLUMNS = `
  id, status, total, item_count as "itemCount", requires_prescription as "requiresPrescription",
  items, status_history as "statusHistory", cancel_reason as "cancelReason",
  created_at as "createdAt", updated_at as "updatedAt", version`;

const SORTS = {
  NAME_ASC: 'm.commercial_name asc, m.id',
  PRICE_ASC: 'm.price asc, m.id',
  PRICE_DESC: 'm.price desc, m.id',
};
const MAX_PAGE = 50;

const badInput = (message) => new GraphQLError(message, { extensions: { code: 'BAD_USER_INPUT' } });
const encodeCursor = (offset) => Buffer.from(`offset:${offset}`).toString('base64');
function decodeCursor(cursor) {
  const match = /^offset:(\d+)$/.exec(Buffer.from(cursor, 'base64').toString());
  if (!match) throw badInput('Cursor inválido');
  return Number(match[1]);
}

export async function searchMedications({ filter = {}, sort, first, after }) {
  if (first < 1 || first > MAX_PAGE) throw badInput(`first debe estar entre 1 y ${MAX_PAGE}`);
  const offset = after ? decodeCursor(after) : 0;

  const where = [];
  const params = [];
  const add = (value) => { params.push(value); return `$${params.length}`; };

  if (filter.search?.trim()) {
    const p = add(`%${filter.search.trim()}%`);
    where.push(`(m.commercial_name ilike ${p} or m.active_ingredient ilike ${p})`);
  }
  if (filter.categoryId != null) where.push(`m.category_id = ${add(toIntId(filter.categoryId))}`);
  if (filter.requiresPrescription != null) where.push(`m.requires_prescription = ${add(filter.requiresPrescription)}`);
  if (filter.inStockOnly) where.push('m.stock > 0');

  // first + 1 filas: si llega la fila extra, hay página siguiente. count(*) over()
  // trae el total en la misma consulta (una sola ida a la BD).
  const rows = await sql(
    `select ${MEDICATION_COLUMNS}, count(*) over() as "totalCount"
     from medications m
     ${where.length ? `where ${where.join(' and ')}` : ''}
     order by ${SORTS[sort]}
     limit ${add(first + 1)} offset ${add(offset)}`,
    params,
  );
  const nodes = rows.slice(0, first);
  return {
    nodes,
    totalCount: rows[0]?.totalCount ?? 0,
    pageInfo: {
      hasNextPage: rows.length > first,
      endCursor: nodes.length ? encodeCursor(offset + nodes.length) : null,
    },
  };
}

export const listCategories = () =>
  sql('select id, name, description from therapeutic_categories order by name');

export async function getCart(id) {
  if (!isUuid(id)) return null;
  const [cart] = await sql('select id, status from carts where id = $1', [id]);
  return cart ?? null;
}

export async function getOrder(id) {
  if (!isUuid(id)) return null;
  const [order] = await sql(`select ${ORDER_COLUMNS} from order_projections where id = $1`, [id]);
  return order ?? null;
}

export function listOrders({ status, first }) {
  if (first < 1 || first > MAX_PAGE) throw badInput(`first debe estar entre 1 y ${MAX_PAGE}`);
  return status
    ? sql(`select ${ORDER_COLUMNS} from order_projections where status = $1 order by created_at desc limit $2`, [status, first])
    : sql(`select ${ORDER_COLUMNS} from order_projections order by created_at desc limit $1`, [first]);
}
