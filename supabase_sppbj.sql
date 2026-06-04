-- Jalankan di Supabase > SQL Editor (sekali). Untuk simpan/lanjut SPPBJ (resumable).
create table if not exists public.sppbj_projects (
  id uuid primary key default gen_random_uuid(),
  nama_pengadaan text,
  status text,
  payload jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.sppbj_projects enable row level security;
create policy "anon full access sppbj" on public.sppbj_projects
  for all using (true) with check (true);
