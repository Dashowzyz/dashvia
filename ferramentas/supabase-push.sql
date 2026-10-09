-- ===== Dashvia: notificações push (tabelas e segurança) =====
-- Rode DEPOIS do supabase.sql. Cole no SQL Editor do Supabase e clique em Run.
-- Pode rodar de novo sem medo. Não apaga nem muda nenhum dado existente.
--
--  - push_inscricoes: um registro por aparelho que ativou as notificações (cada pessoa vê só os seus);
--  - avisos_enviados: lembra o que já foi avisado, para nunca repetir (só o robô de avisos acessa);
--  - estado_envio: guarda a última novidade já avisada (só o robô de avisos acessa).

create table if not exists public.push_inscricoes (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  criado_em timestamptz not null default now()
);

create index if not exists push_inscricoes_user_idx on public.push_inscricoes (user_id);

create table if not exists public.avisos_enviados (
  user_id uuid not null references auth.users (id) on delete cascade,
  chave text not null,
  enviado_em timestamptz not null default now(),
  primary key (user_id, chave)
);

create table if not exists public.estado_envio (
  chave text primary key,
  valor text not null
);

alter table public.push_inscricoes drop constraint if exists push_inscricoes_tamanho_ck;
alter table public.push_inscricoes add constraint push_inscricoes_tamanho_ck
  check (char_length(endpoint) <= 2000 and char_length(p256dh) <= 200 and char_length(auth) <= 100) not valid;

alter table public.push_inscricoes enable row level security;
alter table public.avisos_enviados enable row level security;
alter table public.estado_envio enable row level security;

-- Cada pessoa vê e apaga só os próprios aparelhos. Quem cria é a função registrar_push (abaixo), nunca o site direto.
drop policy if exists "push: ver os proprios" on public.push_inscricoes;
create policy "push: ver os proprios" on public.push_inscricoes
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "push: criar os proprios" on public.push_inscricoes;

drop policy if exists "push: apagar os proprios" on public.push_inscricoes;
create policy "push: apagar os proprios" on public.push_inscricoes
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- avisos_enviados e estado_envio ficam sem política: o site não enxerga nada, só o robô (chave de serviço)
revoke all on public.push_inscricoes, public.avisos_enviados, public.estado_envio from anon, authenticated;
grant select, delete on public.push_inscricoes to authenticated;
revoke insert on public.push_inscricoes from authenticated;

-- Registra o aparelho da pessoa logada. Se o mesmo aparelho (endpoint) ainda estava ligado a outra conta
-- (a pessoa anterior não saiu direito), a ligação antiga é desfeita: assim os avisos de uma conta
-- nunca chegam no aparelho de quem entrou depois.
create or replace function public.registrar_push(p_endpoint text, p_p256dh text, p_auth text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'NAO_AUTENTICADO'; end if;
  delete from public.push_inscricoes where endpoint = p_endpoint;
  insert into public.push_inscricoes (user_id, endpoint, p256dh, auth) values (auth.uid(), p_endpoint, p_p256dh, p_auth);
end;
$$;

revoke all on function public.registrar_push(text, text, text) from public, anon;
grant execute on function public.registrar_push(text, text, text) to authenticated;

notify pgrst, 'reload schema';
