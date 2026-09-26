// DataLoaders: solución al problema N+1.
//
// Se crean NUEVOS en cada operación GraphQL (ver context en index.js):
//   * batching: todas las llamadas .load(id) del mismo tick se agrupan en UNA
//     consulta `WHERE id = ANY($1)`.
//   * caché por request: el mismo id pedido dos veces en la misma operación no
//     vuelve a la BD, y no hay datos rancios entre requests ni entre usuarios.
import DataLoader from 'dataloader';
import { sql } from './db.js';
import { MEDICATION_COLUMNS } from './read/queries.js';

/**
 * @param fetchRows  (keys[]) => filas
 * @param keyField   columna de la fila que corresponde a la clave
 * @param many       true → devuelve un arreglo por clave (relación 1:N)
 */
function batchLoader(name, fetchRows, { keyField = 'id', many = false, normalize = Number } = {}) {
  return new DataLoader(
    async (keys) => {
      const normalized = keys.map(normalize);
      console.log(`  [DataLoader] ${name}: ${keys.length} claves agrupadas → 1 consulta SQL`);
      const rows = await fetchRows(normalized);
      const byKey = new Map();
      for (const row of rows) {
        const k = normalize(row[keyField]);
        if (many) byKey.set(k, [...(byKey.get(k) ?? []), row]);
        else byKey.set(k, row);
      }
      return normalized.map((k) => byKey.get(k) ?? (many ? [] : null));
    },
    { cacheKeyFn: normalize },
  );
}

export function createLoaders() {
  return {
    medicationById: batchLoader('medicationById', (ids) =>
      sql(`select ${MEDICATION_COLUMNS} from medications m where m.id = any($1)`, [ids])),

    laboratoryById: batchLoader('laboratoryById', (ids) =>
      sql('select id, name, country from laboratories where id = any($1)', [ids])),

    categoryById: batchLoader('categoryById', (ids) =>
      sql('select id, name, description from therapeutic_categories where id = any($1)', [ids])),

    // ponytail: trae todos los medicamentos de cada categoría y el resolver corta con `first`;
    // con categorías de miles de ítems, cambiar a LATERAL JOIN ... LIMIT.
    medicationsByCategory: batchLoader('medicationsByCategory', (ids) =>
      sql(`select ${MEDICATION_COLUMNS} from medications m where m.category_id = any($1) order by m.commercial_name`, [ids]),
    { keyField: 'categoryId', many: true }),

    cartItemsByCart: batchLoader('cartItemsByCart', (ids) =>
      sql(`select ci.cart_id as "cartId", ci.medication_id as "medicationId", ci.quantity,
                  m.price, m.requires_prescription as "requiresPrescription"
           from cart_items ci join medications m on m.id = ci.medication_id
           where ci.cart_id = any($1::uuid[]) order by ci.added_at`, [ids]),
    { keyField: 'cartId', many: true, normalize: String }),
  };
}
