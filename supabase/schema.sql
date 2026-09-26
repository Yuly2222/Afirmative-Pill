-- =====================================================================
-- Afirmative Pill — esquema PostgreSQL (Supabase)
-- Ejecutar en: Supabase Dashboard → SQL Editor (o psql). Idempotente
-- solo en la creación inicial: para reiniciar use el bloque DROP de abajo.
-- =====================================================================

-- drop table if exists order_projections, domain_events, prescriptions, order_items,
--   orders, cart_items, carts, medications, therapeutic_categories, laboratories cascade;
-- drop type if exists order_status, cart_status;

create extension if not exists pg_trgm;   -- búsqueda parcial (ILIKE) indexada

-- ---------------------------------------------------------------------
-- CATÁLOGO (fuente de verdad del inventario)
-- ---------------------------------------------------------------------
create table laboratories (
  id      serial primary key,
  name    text not null unique,
  country text not null
);

create table therapeutic_categories (
  id          serial primary key,
  name        text not null unique,
  description text not null
);

create table medications (
  id                    serial primary key,
  commercial_name       text not null,
  active_ingredient     text not null,
  concentration         text not null,
  presentation          text not null,
  laboratory_id         int  not null references laboratories(id),
  category_id           int  not null references therapeutic_categories(id),
  price                 numeric(12,2) not null check (price > 0),
  -- Invariante de último recurso: aunque la aplicación falle, la BD nunca
  -- permitirá stock negativo (vender algo agotado).
  stock                 int  not null check (stock >= 0),
  requires_prescription boolean not null default false,
  indications           text not null,
  contraindications     text not null,
  created_at            timestamptz not null default now()
);

-- Búsqueda por nombre comercial o principio activo con ILIKE '%texto%'.
create index medications_name_trgm       on medications using gin (commercial_name gin_trgm_ops);
create index medications_ingredient_trgm on medications using gin (active_ingredient gin_trgm_ops);
-- Filtros facetados y claves foráneas que usan los DataLoaders (WHERE x = ANY($1)).
create index medications_category_idx    on medications (category_id, commercial_name);
create index medications_laboratory_idx  on medications (laboratory_id);
create index medications_rx_idx          on medications (requires_prescription);
create index medications_price_idx       on medications (price);

-- ---------------------------------------------------------------------
-- MODELO DE ESCRITURA (comandos)
-- ---------------------------------------------------------------------
create type cart_status  as enum ('OPEN', 'CHECKED_OUT');
create type order_status as enum ('PENDING_APPROVAL', 'APPROVED', 'DISPATCHED', 'CANCELLED');

create table carts (
  id         uuid primary key default gen_random_uuid(),
  status     cart_status not null default 'OPEN',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table cart_items (
  cart_id       uuid not null references carts(id) on delete cascade,
  medication_id int  not null references medications(id),
  quantity      int  not null check (quantity > 0),
  added_at      timestamptz not null default now(),
  primary key (cart_id, medication_id)
);

create table orders (
  id                    uuid primary key default gen_random_uuid(),
  -- UNIQUE = idempotencia: un carrito solo puede convertirse en UNA orden
  -- aunque el cliente haga doble clic o reintente la mutación.
  cart_id               uuid not null unique references carts(id),
  status                order_status not null default 'PENDING_APPROVAL',
  total                 numeric(12,2) not null check (total >= 0),
  requires_prescription boolean not null,
  cancel_reason         text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table order_items (
  order_id      uuid not null references orders(id) on delete cascade,
  medication_id int  not null references medications(id),
  quantity      int  not null check (quantity > 0),
  unit_price    numeric(12,2) not null,   -- precio congelado al momento de la compra
  primary key (order_id, medication_id)
);

create table prescriptions (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null unique references orders(id) on delete cascade,
  doctor_name      text not null,
  doctor_license   text not null,
  patient_document text not null,
  issued_at        timestamptz not null,
  notes            text,
  review_notes     text,
  reviewed_at      timestamptz
);

-- Registro append-only de lo que pasó (event log / outbox). Es el puente
-- entre el lado de escritura y las proyecciones de lectura.
create table domain_events (
  id           bigserial primary key,
  aggregate_id uuid  not null,
  type         text  not null,
  payload      jsonb not null default '{}',
  created_at   timestamptz not null default now()
);
create index domain_events_aggregate_idx on domain_events (aggregate_id, id);

-- ---------------------------------------------------------------------
-- MODELO DE LECTURA (proyecciones)
-- ---------------------------------------------------------------------
-- Una fila por orden, desnormalizada y lista para pintar: ítems con nombre y
-- presentación, totales e historial de estados. Se leen con UNA consulta sin
-- JOINs. La escribe exclusivamente el proyector (backend/src/read/projector.js).
create table order_projections (
  id                    uuid primary key,
  status                order_status not null,
  total                 numeric(12,2) not null,
  item_count            int not null,
  requires_prescription boolean not null,
  items                 jsonb not null,
  status_history        jsonb not null,
  cancel_reason         text,
  created_at            timestamptz not null,
  updated_at            timestamptz not null,
  version               bigint not null   -- id del último evento aplicado
);
create index order_projections_created_idx on order_projections (created_at desc);
create index order_projections_status_idx  on order_projections (status, created_at desc);

-- ---------------------------------------------------------------------
-- ZERO-REST también en Supabase
-- ---------------------------------------------------------------------
-- Supabase publica automáticamente cada tabla de `public` como API REST
-- (PostgREST). Para que no exista NINGÚN canal REST hacia los datos, se
-- activa RLS sin políticas y se revocan permisos a los roles de la API.
-- El backend GraphQL se conecta con el rol `postgres` (dueño) y no se ve afectado.
alter table laboratories           enable row level security;
alter table therapeutic_categories enable row level security;
alter table medications            enable row level security;
alter table carts                  enable row level security;
alter table cart_items             enable row level security;
alter table orders                 enable row level security;
alter table order_items            enable row level security;
alter table prescriptions          enable row level security;
alter table domain_events          enable row level security;
alter table order_projections      enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on all tables    in schema public from anon, authenticated;
    revoke all on all sequences in schema public from anon, authenticated;
  end if;
end $$;
