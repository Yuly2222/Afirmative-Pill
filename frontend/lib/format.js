const cop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
export const money = (value) => cop.format(value);
export const dateTime = (iso) => new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });

export const STATUS_LABEL = {
  PENDING_APPROVAL: 'Pendiente de aprobación',
  APPROVED: 'Aprobado',
  DISPATCHED: 'Despachado',
  CANCELLED: 'Cancelado',
};

export const STOCK_LABEL = {
  IN_STOCK: 'Disponible',
  LOW_STOCK: 'Pocas unidades',
  OUT_OF_STOCK: 'Agotado',
};
