'use client';
import Link from 'next/link';
import { useCart } from '../lib/cart';

export default function Nav() {
  const { cart } = useCart();
  return (
    <header className="nav">
      <Link href="/" className="brand">💊 Afirmative Pill</Link>
      <nav>
        <Link href="/">Catálogo</Link>
        <Link href="/orders">Panel de farmacia</Link>
        <Link href="/cart" className="cart-link">
          Carrito <span className="badge">{cart?.itemCount ?? 0}</span>
        </Link>
      </nav>
    </header>
  );
}
