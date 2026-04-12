-- Tabla para gestionar fuentes de datos por tenant
-- Permite en el futuro conectar HubSpot, Salesforce, CSV, etc.
-- con credenciales independientes por tenant.

create table if not exists data_sources (
  id          serial primary key,
  tenant_id   integer not null references tenants(id) on delete cascade,
  source_type text    not null,   -- 'hubspot' | 'salesforce' | 'csv' | ...
  name        text    not null,   -- nombre descriptivo
  credentials jsonb   not null default '{}',  -- tokens, api_keys, etc.
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Índice para lookups por tenant
create index if not exists data_sources_tenant_id_idx on data_sources(tenant_id);

-- Un tenant solo puede tener una fuente activa del mismo tipo
create unique index if not exists data_sources_tenant_source_unique
  on data_sources(tenant_id, source_type)
  where active = true;

-- RLS
alter table data_sources enable row level security;

create policy "Tenant ve solo sus fuentes"
  on data_sources for select
  using (
    tenant_id = (
      select tenant_id from tenant_users
      where auth_user_id = auth.uid()
      limit 1
    )
  );
