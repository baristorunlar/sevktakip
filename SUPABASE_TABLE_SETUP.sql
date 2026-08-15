-- GÜRKAN YAPI MALZEMELERİ - SUPABASE %100 EKSİKSİZ TAM KURULUM KODU
-- SQL Editor'deki her şeyi silip sadece aşağıdaki kodun tamamını yapıştırın ve "RUN" butonuna basın.

-- 1. Veritabanı Tablosunu Oluştur
create table if not exists public.shipments_data (
  id text primary key default 'global_state',
  shipments jsonb,
  disabled_days jsonb,
  representatives jsonb,
  last_action text,
  sender_id text,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 2. Yeni Kolonları Ekleme Garantisi (Eski Tablonuz Varsa Da Günceller)
alter table public.shipments_data add column if not exists representatives jsonb;
alter table public.shipments_data add column if not exists disabled_days jsonb;

-- 3. RLS Güvenlik İzinleri (Hata Vermez)
alter table public.shipments_data enable row level security;
drop policy if exists "Herkes Oku Yaz" on public.shipments_data;
create policy "Herkes Oku Yaz" on public.shipments_data for all using (true) with check (true);

-- 4. Supabase Realtime Canlı Yayın İzni (Hata Vermez)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'shipments_data'
  ) then
    alter publication supabase_realtime add table public.shipments_data;
  end if;
end $$;
