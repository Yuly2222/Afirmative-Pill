'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation } from '@apollo/client/react';
import { PLACE_ORDER, REMOVE_FROM_CART } from '../../lib/operations';
import { resetCart, useCart } from '../../lib/cart';
import { money } from '../../lib/format';

const today = () => new Date().toLocaleDateString('sv'); // YYYY-MM-DD en hora local
const EMPTY_RX = { doctorName: '', doctorLicense: '', patientDocument: '', issuedAt: today(), notes: '' };

export default function CartPage() {
  const router = useRouter();
  const { cart, loading } = useCart();
  const [rx, setRx] = useState(EMPTY_RX);
  const [errors, setErrors] = useState([]);

  const [removeFromCart] = useMutation(REMOVE_FROM_CART);
  const [placeOrder, { loading: placing }] = useMutation(PLACE_ORDER, {
    update(cache, { data: { placeOrder } }) {
      if (!placeOrder.orderId) return;
      // El comando cambió el inventario: se invalida lo que la caché sabe del stock
      // para que el catálogo lo vuelva a pedir, y el carrito queda cerrado.
      cache.modify({ id: cache.identify(cart), fields: { status: () => 'CHECKED_OUT' } });
      for (const { medication } of cart.items) {
        const id = cache.identify(medication);
        cache.evict({ id, fieldName: 'stockStatus' });
        cache.evict({ id, fieldName: 'availableUnits' });
      }
      cache.evict({ fieldName: 'medications' });
      cache.gc();
    },
  });

  if (loading) return <p className="muted">Cargando carrito…</p>;
  if (!cart || cart.items.length === 0) {
    return <><h1>Tu carrito</h1><p>Está vacío. <Link href="/">Ir al catálogo</Link></p></>;
  }

  function remove(item) {
    const items = cart.items.filter((it) => it !== item);
    removeFromCart({
      variables: { input: { cartId: cart.id, medicationId: item.medication.id } },
      // UI optimista: el ítem desaparece al instante; si el servidor falla, Apollo revierte.
      optimisticResponse: {
        removeFromCart: {
          __typename: 'CartPayload',
          errors: [],
          cart: {
            ...cart,
            items,
            itemCount: cart.itemCount - item.quantity,
            total: cart.total - item.subtotal,
            requiresPrescription: items.some((it) => it.medication.requiresPrescription),
          },
        },
      },
    });
  }

  async function submit(e) {
    e.preventDefault();
    setErrors([]);
    const prescription = cart.requiresPrescription
      ? { ...rx, issuedAt: new Date(`${rx.issuedAt}T12:00:00`).toISOString(), notes: rx.notes || null }
      : null;
    try {
      const { data } = await placeOrder({ variables: { input: { cartId: cart.id, prescription } } });
      const result = data.placeOrder;
      if (result.errors.length) return setErrors(result.errors);
      router.push(`/orders/${result.orderId}`);
      resetCart();
    } catch (err) {
      setErrors([{ code: 'NETWORK', message: err.message }]);
    }
  }

  const fieldError = (name) => errors.find((e) => e.field?.at(-1) === name)?.message;
  const itemErrors = (id) => errors.filter((e) => e.medicationId === id);
  const input = (name, label, props = {}) => (
    <label>
      {label}
      <input value={rx[name]} onChange={(e) => setRx({ ...rx, [name]: e.target.value })} {...props} />
      {fieldError(name) && <small className="error">{fieldError(name)}</small>}
    </label>
  );

  return (
    <>
      <h1>Tu carrito</h1>
      <table className="cart">
        <thead><tr><th>Medicamento</th><th>Cant.</th><th>Subtotal</th><th /></tr></thead>
        <tbody>
          {cart.items.map((it) => (
            <tr key={it.medication.id} className={itemErrors(it.medication.id).length ? 'has-error' : ''}>
              <td>
                <strong>{it.medication.commercialName}</strong> {it.medication.requiresPrescription && <span className="tag rx">Fórmula</span>}
                <br /><small className="muted">{it.medication.presentation} · {money(it.medication.price)} c/u</small>
                {itemErrors(it.medication.id).map((e) => <small key={e.code} className="error block">{e.message}</small>)}
              </td>
              <td>{it.quantity}</td>
              <td>{money(it.subtotal)}</td>
              <td><button className="link" onClick={() => remove(it)}>Quitar</button></td>
            </tr>
          ))}
        </tbody>
        <tfoot><tr><td colSpan={2}>Total ({cart.itemCount} uds)</td><td colSpan={2}><strong>{money(cart.total)}</strong></td></tr></tfoot>
      </table>

      <form onSubmit={submit} className="checkout">
        {cart.requiresPrescription && (
          <fieldset>
            <legend>Soporte de fórmula médica</legend>
            <p className="muted">Tu pedido incluye medicamentos que solo se venden con fórmula. Un químico farmacéutico la validará antes de aprobar la orden.</p>
            {input('doctorName', 'Nombre del médico', { required: true })}
            {input('doctorLicense', 'Registro médico', { required: true, placeholder: 'RM-123456' })}
            {input('patientDocument', 'Documento del paciente', { required: true, inputMode: 'numeric' })}
            {input('issuedAt', 'Fecha de expedición', { required: true, type: 'date', max: today() })}
            {input('notes', 'Observaciones (opcional)')}
          </fieldset>
        )}
        {errors.filter((e) => !e.medicationId && !e.field?.includes('prescription')).map((e) => (
          <p key={e.code} className="error">{e.message}</p>
        ))}
        {errors.some((e) => e.code === 'PRESCRIPTION_REQUIRED') && <p className="error">Completa los datos de la fórmula médica.</p>}
        <button type="submit" disabled={placing}>{placing ? 'Enviando pedido…' : 'Confirmar pedido'}</button>
      </form>
    </>
  );
}
