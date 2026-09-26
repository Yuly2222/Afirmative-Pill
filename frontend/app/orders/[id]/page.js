'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@apollo/client/react';
import { ORDER, ORDER_UPDATED } from '../../../lib/operations';
import { dateTime, money, STATUS_LABEL } from '../../../lib/format';

const WAITING_TEXT = {
  PENDING_APPROVAL: (o) => o.requiresPrescription
    ? 'Un químico farmacéutico está validando tu fórmula médica. El inventario ya quedó reservado para ti.'
    : 'Estamos confirmando tu pago. El inventario ya quedó reservado para ti.',
  APPROVED: () => 'Tu pedido fue aprobado y se está alistando para despacho.',
  DISPATCHED: () => 'Tu pedido va en camino.',
  CANCELLED: (o) => `Pedido cancelado: ${o.cancelReason ?? ''}. Las unidades volvieron al inventario.`,
};

export default function OrderPage() {
  const { id } = useParams();
  const { data, loading, error, subscribeToMore, startPolling, stopPolling } = useQuery(ORDER, {
    variables: { id },
    fetchPolicy: 'cache-and-network',
  });
  const order = data?.order;

  // Consistencia eventual, parte 1: justo después de placeOrder la proyección puede
  // no existir todavía (order = null). Se consulta cada segundo hasta que aparece.
  useEffect(() => {
    if (order) stopPolling();
    else startPolling(1000);
    return stopPolling;
  }, [Boolean(order), startPolling, stopPolling]);

  // Consistencia eventual, parte 2: una vez existe, cada cambio de estado llega
  // por WebSocket y se escribe en la caché → la vista se re-renderiza sola.
  useEffect(() => subscribeToMore({
    document: ORDER_UPDATED,
    variables: { orderId: id },
    updateQuery: (_prev, { subscriptionData }) => ({ order: subscriptionData.data.orderUpdated }),
  }), [id, subscribeToMore]);

  if (error) return <p className="error">{error.message}</p>;
  if (!order) {
    return (
      <section className="pending">
        <div className="spinner" aria-hidden />
        <h1>Recibimos tu pedido</h1>
        <p>El comando fue aceptado y tu inventario está reservado. Estamos preparando el resumen de la orden…</p>
        <p className="muted">Orden {id}{loading ? ' · consultando…' : ''}</p>
      </section>
    );
  }

  return (
    <article className="order">
      <Link href="/orders" className="muted">← Panel de farmacia</Link>
      <h1>Pedido <code>{order.id.slice(0, 8)}</code></h1>
      <p><span className={`status ${order.status}`}>{STATUS_LABEL[order.status]}</span> <span className="live">● en vivo</span></p>
      <p>{WAITING_TEXT[order.status](order)}</p>

      <table className="cart">
        <thead><tr><th>Medicamento</th><th>Cant.</th><th>Precio</th><th>Subtotal</th></tr></thead>
        <tbody>
          {order.items.map((it) => (
            <tr key={it.medicationId}>
              <td><Link href={`/medications/${it.medicationId}`}>{it.medicationName}</Link><br /><small className="muted">{it.presentation}</small></td>
              <td>{it.quantity}</td><td>{money(it.unitPrice)}</td><td>{money(it.subtotal)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot><tr><td colSpan={3}>Total ({order.itemCount} uds)</td><td><strong>{money(order.total)}</strong></td></tr></tfoot>
      </table>

      <h2>Historial</h2>
      <ol className="timeline">
        {order.statusHistory.map((s) => (
          <li key={`${s.status}-${s.at}`}>
            <strong>{STATUS_LABEL[s.status]}</strong> <small className="muted">{dateTime(s.at)}</small>
            {s.note && <p>{s.note}</p>}
          </li>
        ))}
      </ol>
      <p className="muted"><small>Proyección v{order.version} · actualizada {dateTime(order.updatedAt)}</small></p>
    </article>
  );
}
