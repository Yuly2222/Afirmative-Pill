'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@apollo/client/react';
import { MEDICATION_DETAIL } from '../../../lib/operations';
import { money, STOCK_LABEL } from '../../../lib/format';
import AddToCart from '../../add-to-cart';

export default function MedicationPage() {
  const { id } = useParams();
  const { data, loading, error } = useQuery(MEDICATION_DETAIL, { variables: { id } });

  if (loading && !data) return <p className="muted">Cargando ficha técnica…</p>;
  if (error) return <p className="error">{error.message}</p>;
  const m = data?.medication;
  if (!m) return <p>El medicamento no existe. <Link href="/">Volver al catálogo</Link></p>;

  return (
    <article className="detail">
      <Link href="/" className="muted">← Catálogo</Link>
      <h1>{m.commercialName}</h1>
      <p className="tags">
        {m.requiresPrescription
          ? <span className="tag rx">Requiere fórmula médica</span>
          : <span className="tag">Venta libre</span>}
        <span className={`tag ${m.stockStatus}`}>{STOCK_LABEL[m.stockStatus]} · {m.availableUnits} uds</span>
      </p>
      <p className="price">{money(m.price)}</p>
      <dl>
        <dt>Principio activo</dt><dd>{m.activeIngredient}</dd>
        <dt>Concentración</dt><dd>{m.concentration}</dd>
        <dt>Presentación</dt><dd>{m.presentation}</dd>
        <dt>Laboratorio</dt><dd>{m.laboratory.name} ({m.laboratory.country})</dd>
        <dt>Categoría terapéutica</dt><dd>{m.category.name}</dd>
        <dt>Indicaciones</dt><dd>{m.indications}</dd>
        <dt>Contraindicaciones</dt><dd>{m.contraindications}</dd>
      </dl>
      <AddToCart medicationId={m.id} disabled={m.stockStatus === 'OUT_OF_STOCK'} withQuantity />
    </article>
  );
}
