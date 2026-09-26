'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useSubscription } from '@apollo/client/react';
import { CANCEL_ORDER, DISPATCH_ORDER, ORDER_UPDATED, ORDERS, REVIEW_PRESCRIPTION } from '../../lib/operations';
import { dateTime, money, STATUS_LABEL } from '../../lib/format';

// Tras un comando exitoso se escribe el nuevo estado en la entidad Order cacheada
// sin esperar al proyector. La subscription luego trae la proyección completa
// (historial, versión) y reconcilia.
function applyStatus(cache, { data }) {
  const { orderId, status } = Object.values(data)[0];
  if (orderId) cache.modify({ id: cache.identify({ __typename: 'Order', id: orderId }), fields: { status: () => status } });
}
const optimistic = (field, orderId, status) => ({
  [field]: { __typename: 'OrderCommandPayload', orderId, status, errors: [] },
});

export default function OrdersPanel() {
  const [feedback, setFeedback] = useState(null);
  const { data, loading, error } = useQuery(ORDERS, { fetchPolicy: 'cache-and-network' });

  // Todas las órdenes en vivo. El resultado se normaliza en la caché (Order:<id>),
  // así que las filas existentes se actualizan solas; aquí solo se agregan las nuevas.
  useSubscription(ORDER_UPDATED, {
    variables: { orderId: null },
    onData({ client, data: { data: payload } }) {
      const order = payload?.orderUpdated;
      if (!order) return;
      client.cache.modify({
        fields: {
          orders(existing = [], { readField, toReference }) {
            if (existing.some((ref) => readField('id', ref) === order.id)) return existing;
            return [toReference(order), ...existing];
          },
        },
      });
    },
  });

  const [review] = useMutation(REVIEW_PRESCRIPTION, { update: applyStatus });
  const [dispatch] = useMutation(DISPATCH_ORDER, { update: applyStatus });
  const [cancel] = useMutation(CANCEL_ORDER, { update: applyStatus });

  async function run(promise) {
    setFeedback(null);
    try {
      const { data } = await promise;
      const { errors } = Object.values(data)[0];
      if (errors.length) setFeedback(errors[0].message);
    } catch (err) {
      setFeedback(err.message);
    }
  }

  const approve = (o) => run(review({ variables: { input: { orderId: o.id, approved: true } }, optimisticResponse: optimistic('reviewPrescription', o.id, 'APPROVED') }));
  const reject = (o) => {
    const notes = window.prompt('Motivo del rechazo de la fórmula');
    if (notes) run(review({ variables: { input: { orderId: o.id, approved: false, notes } }, optimisticResponse: optimistic('reviewPrescription', o.id, 'CANCELLED') }));
  };
  const ship = (o) => run(dispatch({ variables: { orderId: o.id }, optimisticResponse: optimistic('dispatchOrder', o.id, 'DISPATCHED') }));
  const annul = (o) => {
    const reason = window.prompt('Motivo de la cancelación');
    if (reason) run(cancel({ variables: { input: { orderId: o.id, reason } }, optimisticResponse: optimistic('cancelOrder', o.id, 'CANCELLED') }));
  };

  return (
    <>
      <h1>Panel de farmacia</h1>
      <p className="muted">Órdenes proyectadas en tiempo real. Las órdenes con fórmula esperan validación del químico farmacéutico; las de venta libre se aprueban al confirmarse el pago.</p>
      {feedback && <p className="error">{feedback}</p>}
      {error && <p className="error">{error.message}</p>}
      {loading && !data && <p className="muted">Cargando órdenes…</p>}
      {data?.orders.length === 0 && <p>Aún no hay órdenes.</p>}

      <ul className="orders">
        {data?.orders.map((o) => (
          <li key={o.id} className="card">
            <div>
              <Link href={`/orders/${o.id}`}><code>{o.id.slice(0, 8)}</code></Link>{' '}
              <span className={`status ${o.status}`}>{STATUS_LABEL[o.status]}</span>
              {o.requiresPrescription && <span className="tag rx">Fórmula</span>}
              <p className="muted"><small>{dateTime(o.createdAt)} · {o.itemCount} uds · {money(o.total)}</small></p>
              <small>{o.items.map((it) => `${it.quantity}× ${it.medicationName}`).join(', ')}</small>
            </div>
            <div className="actions">
              {o.status === 'PENDING_APPROVAL' && o.requiresPrescription && <>
                <button onClick={() => approve(o)}>Aprobar fórmula</button>
                <button className="secondary" onClick={() => reject(o)}>Rechazar</button>
              </>}
              {o.status === 'APPROVED' && <button onClick={() => ship(o)}>Despachar</button>}
              {['PENDING_APPROVAL', 'APPROVED'].includes(o.status) && <button className="link" onClick={() => annul(o)}>Cancelar</button>}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
