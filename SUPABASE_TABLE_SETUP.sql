-- GÜRKAN YAPI MALZEMELERİ - SUPABASE %100 EKSİKSİZ TAM KURULUM KODU
-- SQL Editor'deki her şeyi silip sadece aşağıdaki kodun tamamını yapıştırın ve "RUN" butonuna basın.

-- 1. Veritabanı Tablosunu Oluştur
create table if not exists public.shipments_data (
  id text primary key default 'global_state',
  shipments jsonb,
  disabled_days jsonb,
  representatives jsonb,
  weekly_notes jsonb,
  audit_logs jsonb,
  fuel_prices jsonb,
  last_mutation_time bigint,
  last_action text,
  sender_id text,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 2. Tüm Kolonların Varlığını Garanti Et (Eski Tabloyu Günceller)
alter table public.shipments_data add column if not exists representatives jsonb;
alter table public.shipments_data add column if not exists disabled_days jsonb;
alter table public.shipments_data add column if not exists weekly_notes jsonb;
alter table public.shipments_data add column if not exists audit_logs jsonb;
alter table public.shipments_data add column if not exists fuel_prices jsonb;
alter table public.shipments_data add column if not exists last_mutation_time bigint;

-- 3. RLS Güvenlik İzinleri (Herkes Oku / Yaz)
alter table public.shipments_data enable row level security;
drop policy if exists "Herkes Oku Yaz" on public.shipments_data;
create policy "Herkes Oku Yaz" on public.shipments_data for all using (true) with check (true);

-- 4. Supabase Realtime Canlı Yayın İzni
do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'shipments_data'
  ) then
    alter publication supabase_realtime add table public.shipments_data;
  end if;
end $$;
