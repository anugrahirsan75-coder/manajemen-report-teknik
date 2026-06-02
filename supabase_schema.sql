-- Jalankan di Supabase > SQL Editor
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  nama_kapal text,
  tahun int,
  payload jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Demo: izinkan akses anon (untuk produksi ganti dengan auth)
alter table public.projects enable row level security;

create policy "anon full access" on public.projects
  for all using (true) with check (true);
