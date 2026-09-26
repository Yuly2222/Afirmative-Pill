'use client';
import { useState } from 'react';
import { useCart } from '../lib/cart';

export default function AddToCart({ medicationId, disabled, withQuantity = false }) {
  const { addToCart } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  async function onClick() {
    setBusy(true);
    setMessage(null);
    try {
      const errors = await addToCart(medicationId, quantity);
      setMessage(errors.length ? { error: true, text: errors[0].message } : { text: 'Agregado al carrito ✓' });
    } catch (err) {
      setMessage({ error: true, text: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="add-to-cart">
      {withQuantity && (
        <input type="number" min={1} value={quantity} aria-label="Cantidad"
          onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))} />
      )}
      <button onClick={onClick} disabled={disabled || busy}>{busy ? 'Agregando…' : disabled ? 'Agotado' : 'Agregar'}</button>
      {message && <small className={message.error ? 'error' : 'ok'}>{message.text}</small>}
    </div>
  );
}
