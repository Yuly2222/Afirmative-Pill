'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@apollo/client/react';
import { CATALOG, CATEGORIES } from '../lib/operations';
import { money, STOCK_LABEL } from '../lib/format';
import AddToCart from './add-to-cart';

function useDebounced(value, ms) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export default function CatalogPage() {
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [rx, setRx] = useState('');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sort, setSort] = useState('NAME_ASC');
  const debouncedSearch = useDebounced(search, 300);

  const filter = {
    search: debouncedSearch || null,
    categoryId: categoryId || null,
    requiresPrescription: rx === '' ? null : rx === 'true',
    inStockOnly,
  };
  const { data, loading, error, fetchMore } = useQuery(CATALOG, { variables: { filter, sort } });
  const { data: categories } = useQuery(CATEGORIES);
  const page = data?.medications;

  return (
    <>
      <h1>Catálogo de medicamentos</h1>
      <section className="filters">
        <input type="search" placeholder="Buscar por nombre comercial o principio activo…"
          value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} aria-label="Categoría terapéutica">
          <option value="">Todas las categorías</option>
          {categories?.therapeuticCategories.map((c) => (
            <option key={c.id} value={c.id}>{c.name} ({c.medicationCount})</option>
          ))}
        </select>
        <select value={rx} onChange={(e) => setRx(e.target.value)} aria-label="Fórmula médica">
          <option value="">Con y sin fórmula</option>
          <option value="false">Venta libre (OTC)</option>
          <option value="true">Requiere fórmula</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Orden">
          <option value="NAME_ASC">Nombre A-Z</option>
          <option value="PRICE_ASC">Precio menor</option>
          <option value="PRICE_DESC">Precio mayor</option>
        </select>
        <label className="check">
          <input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} /> Solo disponibles
        </label>
      </section>

      {error && <p className="error">No se pudo cargar el catálogo: {error.message}</p>}
      {loading && !page && <p className="muted">Cargando catálogo…</p>}
      {page && <p className="muted">{page.totalCount} resultados</p>}

      <ul className="grid">
        {page?.nodes.map((m) => (
          <li key={m.id} className="card">
            <Link href={`/medications/${m.id}`}><h3>{m.commercialName}</h3></Link>
            <p className="muted">{m.presentation}</p>
            <p className="price">{money(m.price)}</p>
            <p className="tags">
              {m.requiresPrescription && <span className="tag rx">Requiere fórmula</span>}
              <span className={`tag ${m.stockStatus}`}>{STOCK_LABEL[m.stockStatus]}</span>
            </p>
            <AddToCart medicationId={m.id} disabled={m.stockStatus === 'OUT_OF_STOCK'} />
          </li>
        ))}
      </ul>

      {page?.pageInfo.hasNextPage && (
        <button className="secondary" disabled={loading}
          onClick={() => fetchMore({ variables: { after: page.pageInfo.endCursor } })}>
          {loading ? 'Cargando…' : 'Cargar más'}
        </button>
      )}
    </>
  );
}
