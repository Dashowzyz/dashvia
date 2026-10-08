-- ===== Dashvia no Supabase: tabelas e segurança =====
-- Cole tudo isto no SQL Editor do Supabase e clique em Run.
-- Pode rodar de novo sem medo: nada é apagado, só o que falta é criado.
--
-- Os usuários ficam na tabela auth.users, criada pelo próprio Supabase.

-- Perfil de cada pessoa (nome, apelido, foto, cores do tema e banco favorito)
create table if not exists public.perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null default '',
  usuario text not null default '',
  foto text not null default '',
  tema jsonb,
  banco_favorito text,
  criado_em timestamptz not null default now()
);

-- Gastos e assinaturas
create table if not exists public.gastos (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plataforma text not null,
  categoria text not null,
  parcelas text not null,
  data date not null,
  valor numeric(12, 2) not null check (valor > 0),
  vencimento integer check (vencimento between 1 and 31),
  banco text not null,
  cancelado_em date,
  pagas_ate integer not null default 0 check (pagas_ate >= 0),
  pagas_fim integer not null default 0 check (pagas_fim >= 0),
  criado_em timestamptz not null default now()
);

create index if not exists gastos_user_idx on public.gastos (user_id);

-- Cada pessoa só enxerga e mexe nos próprios dados (Row Level Security)
alter table public.perfis enable row level security;
alter table public.gastos enable row level security;

drop policy if exists "perfis: ver o proprio" on public.perfis;
create policy "perfis: ver o proprio" on public.perfis
  for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "perfis: criar o proprio" on public.perfis;
create policy "perfis: criar o proprio" on public.perfis
  for insert to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "perfis: editar o proprio" on public.perfis;
create policy "perfis: editar o proprio" on public.perfis
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "gastos: ver os proprios" on public.gastos;
create policy "gastos: ver os proprios" on public.gastos
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "gastos: criar os proprios" on public.gastos;
create policy "gastos: criar os proprios" on public.gastos
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "gastos: editar os proprios" on public.gastos;
create policy "gastos: editar os proprios" on public.gastos
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "gastos: apagar os proprios" on public.gastos;
create policy "gastos: apagar os proprios" on public.gastos
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Só quem está logado acessa as tabelas (visitantes sem login não enxergam nada)
revoke all on public.perfis from anon;
revoke all on public.gastos from anon;
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.perfis to authenticated;
grant select, insert, update, delete on public.gastos to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- O perfil é criado pelo próprio site no primeiro acesso, então não precisa de gatilho.

-- Excluir a própria conta: apaga o usuário e, em cascata, o perfil e os gastos dele
create or replace function public.excluir_minha_conta()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Não autenticado';
  end if;

  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.excluir_minha_conta() from public, anon;
grant execute on function public.excluir_minha_conta() to authenticated;
