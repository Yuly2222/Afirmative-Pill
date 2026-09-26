'use client';
import { useEffect } from 'react';
import { makeVar } from '@apollo/client';
import { useMutation, useQuery, useReactiveVar } from '@apollo/client/react';
import { ADD_TO_CART, CART, CREATE_CART } from './operations';

// Estado local del cliente dentro de Apollo: el id del carrito vive en una
// reactive var (y en localStorage para sobrevivir recargas). Cualquier componente
// que lo lea se re-renderiza cuando cambia.
const KEY = 'afirmative-pill:cartId';
export const cartIdVar = makeVar(null);

function setCartId(id) {
  cartIdVar(id);
  try { id ? localStorage.setItem(KEY, id) : localStorage.removeItem(KEY); } catch {}
}
export const resetCart = () => setCartId(null);

export function useCart() {
  const cartId = useReactiveVar(cartIdVar);
  useEffect(() => {
    try { if (!cartIdVar()) cartIdVar(localStorage.getItem(KEY)); } catch {}
  }, []);

  const { data, loading } = useQuery(CART, { variables: { id: cartId }, skip: !cartId });
  const cart = data?.cart?.status === 'OPEN' ? data.cart : null;

  const [createCart] = useMutation(CREATE_CART, {
    // Escribe el carrito nuevo directo en la caché: el badge del menú no necesita refetch.
    update(cache, { data: { createCart } }) {
      cache.writeQuery({ query: CART, variables: { id: createCart.cart.id }, data: { cart: createCart.cart } });
    },
  });
  // addToCart devuelve el Cart completo con su id → la caché normalizada lo
  // actualiza sola y todas las vistas que lo muestran se refrescan.
  const [addMutation] = useMutation(ADD_TO_CART);

  async function addToCart(medicationId, quantity = 1) {
    let id = cart?.id;
    if (!id) {
      const res = await createCart();
      id = res.data.createCart.cart.id;
      setCartId(id);
    }
    const res = await addMutation({ variables: { input: { cartId: id, medicationId, quantity } } });
    return res.data.addToCart.errors;
  }

  return { cart, loading, addToCart };
}
