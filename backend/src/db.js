import pg from 'pg';

// numeric (precios) y bigint (count, version) llegan como string por defecto.
// ponytail: Number es exacto hasta 2^53; suficiente para pesos COP y ids de eventos.
pg.types.setTypeParser(1700, Number);
pg.types.setTypeParser(20, Number);

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
  max: Number(process.env.DATABASE_POOL_SIZE ?? 10),
});

// Validación de ids en la frontera: un id mal formado se trata como "no existe"
// en vez de dejar que Postgres lance un error de sintaxis.
export const toIntId = (id) => (/^\d{1,9}$/.test(String(id)) ? Number(id) : null);
export const isUuid = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id));

let seq = 0;
const logSql = process.env.LOG_SQL !== 'false';

/** Ejecuta SQL y lo registra en consola: es la evidencia de cuántas consultas genera cada operación GraphQL. */
export async function sql(text, params = [], client = pool) {
  const { rows } = await client.query(text, params);
  if (logSql) {
    const oneLine = text.replace(/\s+/g, ' ').trim();
    console.log(`  [SQL #${++seq}] ${oneLine.slice(0, 140)}${oneLine.length > 140 ? '…' : ''} ${JSON.stringify(params)} → ${rows.length} filas`);
  }
  return rows;
}

/** Transacción: `fn` recibe un `sql` ligado a la misma conexión. Rollback ante cualquier excepción. */
export async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn((text, params) => sql(text, params, client));
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
