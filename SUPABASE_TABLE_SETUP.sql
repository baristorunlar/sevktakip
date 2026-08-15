-- GÜRKAN YAPI MALZEMELERİ - SUPABASE KALICI VERİTABANI TABLOSU (1 TIKSLA ÇALIŞTIRIN)
-- Supabase Dashboard -> SQL Editor alanına kopyalayıp "Run" butonuna basın.

-- 1. Veritabanı Tablosunu Oluştur
create table if not exists public.shipments_data (
  id text primary key default 'global_state',
  shipments jsonb,
  disabled_days jsonb,
  last_action text,
  sender_id text,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 2. Herkese Okuma ve Yazma İzni Ver (Public RLS Policy)
alter table public.shipments_data enable row level security;

drop policy if exists "Herkes Oku Yaz" on public.shipments_data;
create policy "Herkes Oku Yaz" on public.shipments_data
  for all
  using (true)
  with check (true);

-- 3. Supabase Realtime Canlı Yayın İznini Aç
alter publication supabase_realtime add table public.shipments_data;
