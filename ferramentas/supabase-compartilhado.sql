-- ===== Dashvia: espaço compartilhado (até 6 pessoas) =====
-- Rode DEPOIS do supabase.sql. Cole tudo no SQL Editor do Supabase e clique em Run.
-- Pode rodar de novo sem medo. Não apaga nem muda os gastos que já existem:
-- os gastos de hoje continuam individuais (espaco_id vazio) e o site atual segue funcionando.
--
-- Regras:
--  - cada pessoa está em no máximo 1 espaço;
--  - o espaço tem 1 líder e no máximo 6 membros;
--  - no espaço só entram gastos das categorias Boleto, Assinatura e Mercado;
--  - qualquer membro adiciona, edita, marca como pago e apaga; tudo vai para o histórico;
--  - o histórico guarda só os últimos 30 dias (o resto é apagado sozinho);
--  - o líder só sai depois de passar a liderança.

-- ---------- Tabelas ----------

create table if not exists public.espacos (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) between 2 and 30),
  lider_id uuid not null references auth.users (id) on delete restrict,
  criado_em timestamptz not null default now()
);

-- user_id como chave: uma pessoa só pode estar em um espaço
create table if not exists public.membros (
  user_id uuid primary key references auth.users (id) on delete cascade,
  espaco_id uuid not null references public.espacos (id) on delete cascade,
  entrou_em timestamptz not null default now()
);

create index if not exists membros_espaco_idx on public.membros (espaco_id);

create table if not exists public.convites (
  codigo text primary key,
  espaco_id uuid not null references public.espacos (id) on delete cascade,
  criado_por uuid references auth.users (id) on delete set null,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null default (now() + interval '7 days'),
  usado_por uuid references auth.users (id) on delete set null,
  usado_em timestamptz
);

-- Sem chave estrangeira em espaco_id de propósito: o registro pode ficar para trás
-- quando o espaço é apagado, e o próprio banco o limpa depois.
create table if not exists public.historico_espaco (
  id bigint generated always as identity primary key,
  espaco_id uuid not null,
  user_id uuid references auth.users (id) on delete set null,
  nome_pessoa text,
  acao text not null check (acao in ('adicionou', 'editou', 'apagou', 'pagamento')),
  plataforma text,
  categoria text,
  valor numeric(12, 2),
  quando timestamptz not null default now()
);

create index if not exists historico_espaco_idx on public.historico_espaco (espaco_id, quando desc);

-- ---------- Gastos: individual (espaco_id vazio) ou do espaço ----------

alter table public.gastos add column if not exists espaco_id uuid references public.espacos (id) on delete cascade;

-- O dono do gasto vira opcional: se a pessoa apagar a conta, o gasto do espaço continua lá
alter table public.gastos alter column user_id drop not null;
alter table public.gastos drop constraint if exists gastos_user_id_fkey;
alter table public.gastos add constraint gastos_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete set null;

alter table public.gastos drop constraint if exists gastos_dono_ck;
alter table public.gastos add constraint gastos_dono_ck
  check (espaco_id is not null or user_id is not null);

alter table public.gastos drop constraint if exists gastos_categoria_espaco_ck;
alter table public.gastos add constraint gastos_categoria_espaco_ck
  check (espaco_id is null or categoria in ('Boleto', 'Assinatura', 'Mercado'));

create index if not exists gastos_espaco_idx on public.gastos (espaco_id);

-- ---------- Funções de apoio ----------

-- Espaço em que a pessoa logada está (vazio se não estiver em nenhum)
create or replace function public.meu_espaco()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select espaco_id from public.membros where user_id = auth.uid()
$$;

revoke all on function public.meu_espaco() from public, anon;
grant execute on function public.meu_espaco() to authenticated;

-- Código do convite: 8 letras e números sem os confusos (0, O, 1, I, L)
create or replace function public._codigo_convite()
returns text
language plpgsql
volatile
as $$
declare
  letras constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  bytes bytea := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
  codigo text := '';
  i int;
begin
  for i in 0..7 loop
    codigo := codigo || substr(letras, 1 + (get_byte(bytes, i) % length(letras)), 1);
  end loop;
  return codigo;
end;
$$;

revoke all on function public._codigo_convite() from public, anon, authenticated;

-- ---------- Segurança dos gastos (Row Level Security) ----------

drop policy if exists "gastos: ver os proprios" on public.gastos;
drop policy if exists "gastos: criar os proprios" on public.gastos;
drop policy if exists "gastos: editar os proprios" on public.gastos;
drop policy if exists "gastos: apagar os proprios" on public.gastos;
drop policy if exists "gastos: ver" on public.gastos;
drop policy if exists "gastos: criar" on public.gastos;
drop policy if exists "gastos: editar" on public.gastos;
drop policy if exists "gastos: apagar" on public.gastos;

-- Individual: só o dono. Do espaço: só quem é membro daquele espaço.
create policy "gastos: ver" on public.gastos
  for select to authenticated
  using (
    (espaco_id is null and user_id = (select auth.uid()))
    or (espaco_id is not null and espaco_id = (select public.meu_espaco()))
  );

create policy "gastos: criar" on public.gastos
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (espaco_id is null or espaco_id = (select public.meu_espaco()))
  );

create policy "gastos: editar" on public.gastos
  for update to authenticated
  using (
    (espaco_id is null and user_id = (select auth.uid()))
    or (espaco_id is not null and espaco_id = (select public.meu_espaco()))
  )
  with check (
    (espaco_id is null and user_id = (select auth.uid()))
    or (espaco_id is not null and espaco_id = (select public.meu_espaco()))
  );

create policy "gastos: apagar" on public.gastos
  for delete to authenticated
  using (
    (espaco_id is null and user_id = (select auth.uid()))
    or (espaco_id is not null and espaco_id = (select public.meu_espaco()))
  );

-- Quem divide o espaço pode ver nome, apelido e foto um do outro
drop policy if exists "perfis: ver quem divide o espaco" on public.perfis;
create policy "perfis: ver quem divide o espaco" on public.perfis
  for select to authenticated
  using (
    exists (
      select 1 from public.membros m
      where m.user_id = perfis.id and m.espaco_id = (select public.meu_espaco())
    )
  );

-- ---------- Segurança das tabelas novas ----------
-- Ninguém escreve direto: tudo passa pelas funções abaixo, que conferem as regras.

alter table public.espacos enable row level security;
alter table public.membros enable row level security;
alter table public.convites enable row level security;
alter table public.historico_espaco enable row level security;

drop policy if exists "espacos: ver o meu" on public.espacos;
create policy "espacos: ver o meu" on public.espacos
  for select to authenticated
  using (id = (select public.meu_espaco()));

drop policy if exists "membros: ver os do meu espaco" on public.membros;
create policy "membros: ver os do meu espaco" on public.membros
  for select to authenticated
  using (espaco_id = (select public.meu_espaco()));

-- Só os últimos 30 dias aparecem, mesmo que o registro velho ainda não tenha sido apagado
drop policy if exists "historico: ver o do meu espaco" on public.historico_espaco;
create policy "historico: ver o do meu espaco" on public.historico_espaco
  for select to authenticated
  using (espaco_id = (select public.meu_espaco()) and quando > now() - interval '30 days');

revoke all on public.espacos, public.membros, public.convites, public.historico_espaco from anon, authenticated;
grant select on public.espacos, public.membros, public.historico_espaco to authenticated;

-- ---------- Proteções e histórico dos gastos ----------

-- O gasto não muda de lugar (individual <-> espaço) nem de autor depois de criado
create or replace function public._proteger_gasto()
returns trigger
language plpgsql
as $$
begin
  if new.espaco_id is distinct from old.espaco_id then
    raise exception 'ESPACO_FIXO';
  end if;
  -- o autor só muda para vazio, quando a conta dele é apagada
  if new.user_id is distinct from old.user_id and new.user_id is not null then
    raise exception 'AUTOR_FIXO';
  end if;
  return new;
end;
$$;

revoke all on function public._proteger_gasto() from public, anon, authenticated;

drop trigger if exists proteger_gasto on public.gastos;
create trigger proteger_gasto
  before update on public.gastos
  for each row execute function public._proteger_gasto();

-- Anota no histórico quem adicionou, editou, marcou como pago ou apagou um gasto do espaço
create or replace function public._registrar_historico()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  linha public.gastos;
  acao text;
  quem uuid := auth.uid();
  nome_quem text;
begin
  if tg_op = 'DELETE' then
    linha := old;
    acao := 'apagou';
  elsif tg_op = 'INSERT' then
    linha := new;
    acao := 'adicionou';
  else
    linha := new;
    -- só trocou o autor (conta apagada): não é uma alteração do gasto
    if (to_jsonb(new) - 'user_id') = (to_jsonb(old) - 'user_id') then
      return new;
    end if;
    -- só mudou o que foi pago: é um pagamento; qualquer outra coisa é edição
    if (to_jsonb(new) - 'user_id' - 'pagas_ate' - 'pagas_fim')
       = (to_jsonb(old) - 'user_id' - 'pagas_ate' - 'pagas_fim') then
      acao := 'pagamento';
    else
      acao := 'editou';
    end if;
  end if;

  if linha.espaco_id is not null then
    select p.nome into nome_quem from public.perfis p where p.id = quem;

    insert into public.historico_espaco (espaco_id, user_id, nome_pessoa, acao, plataforma, categoria, valor)
    values (linha.espaco_id, quem, nome_quem, acao, linha.plataforma, linha.categoria, linha.valor);

    -- Limpeza automática: nada com mais de 30 dias fica guardado
    delete from public.historico_espaco
    where espaco_id = linha.espaco_id and quando < now() - interval '30 days';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public._registrar_historico() from public, anon, authenticated;

drop trigger if exists registrar_historico on public.gastos;
create trigger registrar_historico
  after insert or update or delete on public.gastos
  for each row execute function public._registrar_historico();

-- Quando a conta é apagada, os gastos individuais dela vão junto (os do espaço ficam)
create or replace function public._limpar_gastos_individuais()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.gastos where user_id = old.id and espaco_id is null;
  return old;
end;
$$;

revoke all on function public._limpar_gastos_individuais() from public, anon, authenticated;

drop trigger if exists limpar_gastos_individuais on auth.users;
create trigger limpar_gastos_individuais
  before delete on auth.users
  for each row execute function public._limpar_gastos_individuais();

-- ---------- Ações do espaço (o site chama estas funções) ----------
-- Os erros voltam como códigos curtos (ex.: ESPACO_CHEIO) para o site mostrar a mensagem certa.

create or replace function public.criar_espaco(p_nome text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  nome_limpo text := regexp_replace(trim(coalesce(p_nome, '')), '\s+', ' ', 'g');
  novo uuid;
begin
  if uid is null then raise exception 'NAO_AUTENTICADO'; end if;
  if char_length(nome_limpo) < 2 or char_length(nome_limpo) > 30 then raise exception 'NOME_INVALIDO'; end if;
  if exists (select 1 from public.membros where user_id = uid) then raise exception 'JA_TEM_ESPACO'; end if;

  insert into public.espacos (nome, lider_id) values (nome_limpo, uid) returning id into novo;
  insert into public.membros (user_id, espaco_id) values (uid, novo);
  return novo;
end;
$$;

create or replace function public.gerar_convite()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  eid uuid;
  novo text;
  tentativas int := 0;
begin
  if uid is null then raise exception 'NAO_AUTENTICADO'; end if;
  select id into eid from public.espacos where lider_id = uid;
  if eid is null then raise exception 'SO_LIDER'; end if;

  loop
    novo := public._codigo_convite();
    begin
      insert into public.convites (codigo, espaco_id, criado_por) values (novo, eid, uid);
      return novo;
    exception when unique_violation then
      tentativas := tentativas + 1;
      if tentativas > 5 then raise; end if;
    end;
  end loop;
end;
$$;

create or replace function public.entrar_com_codigo(p_codigo text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  conv public.convites;
  total int;
begin
  if uid is null then raise exception 'NAO_AUTENTICADO'; end if;
  if exists (select 1 from public.membros where user_id = uid) then raise exception 'JA_TEM_ESPACO'; end if;

  select * into conv from public.convites
  where codigo = upper(trim(coalesce(p_codigo, ''))) and usado_por is null and expira_em > now()
  for update;
  if not found then raise exception 'CODIGO_INVALIDO'; end if;

  -- trava o espaço para dois convites não passarem do limite ao mesmo tempo
  perform 1 from public.espacos where id = conv.espaco_id for update;
  select count(*) into total from public.membros where espaco_id = conv.espaco_id;
  if total >= 6 then raise exception 'ESPACO_CHEIO'; end if;

  insert into public.membros (user_id, espaco_id) values (uid, conv.espaco_id);
  update public.convites set usado_por = uid, usado_em = now() where codigo = conv.codigo;
  return conv.espaco_id;
end;
$$;

create or replace function public.listar_membros()
returns table (id uuid, nome text, usuario text, foto text, eh_lider boolean, entrou_em timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select m.user_id, coalesce(p.nome, ''), coalesce(p.usuario, ''), coalesce(p.foto, ''),
         (e.lider_id = m.user_id), m.entrou_em
  from public.membros m
  join public.espacos e on e.id = m.espaco_id
  left join public.perfis p on p.id = m.user_id
  where m.espaco_id = public.meu_espaco()
  order by (e.lider_id = m.user_id) desc, m.entrou_em
$$;

create or replace function public.remover_membro(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  eid uuid;
begin
  if uid is null then raise exception 'NAO_AUTENTICADO'; end if;
  select id into eid from public.espacos where lider_id = uid;
  if eid is null then raise exception 'SO_LIDER'; end if;
  if p_user = uid then raise exception 'USE_SAIR'; end if;

  delete from public.membros where user_id = p_user and espaco_id = eid;
  if not found then raise exception 'NAO_E_MEMBRO'; end if;
end;
$$;

create or replace function public.passar_lideranca(p_novo uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  eid uuid;
begin
  if uid is null then raise exception 'NAO_AUTENTICADO'; end if;
  select id into eid from public.espacos where lider_id = uid;
  if eid is null then raise exception 'SO_LIDER'; end if;
  if p_novo = uid then raise exception 'JA_E_LIDER'; end if;
  if not exists (select 1 from public.membros where user_id = p_novo and espaco_id = eid) then
    raise exception 'NAO_E_MEMBRO';
  end if;

  update public.espacos set lider_id = p_novo where id = eid;
end;
$$;

create or replace function public.sair_do_espaco()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  eid uuid := public.meu_espaco();
  outros int;
begin
  if uid is null then raise exception 'NAO_AUTENTICADO'; end if;
  if eid is null then raise exception 'SEM_ESPACO'; end if;

  if exists (select 1 from public.espacos where id = eid and lider_id = uid) then
    select count(*) into outros from public.membros where espaco_id = eid and user_id <> uid;
    if outros > 0 then raise exception 'PASSE_LIDERANCA'; end if;
    raise exception 'USE_EXCLUIR_ESPACO';
  end if;

  delete from public.membros where user_id = uid;
end;
$$;

-- Só o líder, e só quando está sozinho. Apaga também os gastos e o histórico do espaço.
create or replace function public.excluir_espaco()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  eid uuid;
  outros int;
begin
  if uid is null then raise exception 'NAO_AUTENTICADO'; end if;
  select id into eid from public.espacos where lider_id = uid;
  if eid is null then raise exception 'SO_LIDER'; end if;

  select count(*) into outros from public.membros where espaco_id = eid and user_id <> uid;
  if outros > 0 then raise exception 'REMOVA_MEMBROS'; end if;

  delete from public.espacos where id = eid;
  delete from public.historico_espaco where espaco_id = eid;
end;
$$;

revoke all on function public.criar_espaco(text), public.gerar_convite(), public.entrar_com_codigo(text),
  public.listar_membros(), public.remover_membro(uuid), public.passar_lideranca(uuid),
  public.sair_do_espaco(), public.excluir_espaco() from public, anon;

grant execute on function public.criar_espaco(text), public.gerar_convite(), public.entrar_com_codigo(text),
  public.listar_membros(), public.remover_membro(uuid), public.passar_lideranca(uuid),
  public.sair_do_espaco(), public.excluir_espaco() to authenticated;

-- ---------- Excluir a própria conta ----------
-- O líder com outras pessoas no espaço precisa passar a liderança antes.
-- O líder sozinho tem o espaço apagado junto com a conta.

create or replace function public.excluir_minha_conta()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  eid uuid;
  outros int;
begin
  if uid is null then
    raise exception 'Não autenticado';
  end if;

  select id into eid from public.espacos where lider_id = uid;
  if eid is not null then
    select count(*) into outros from public.membros where espaco_id = eid and user_id <> uid;
    if outros > 0 then raise exception 'PASSE_LIDERANCA'; end if;
    delete from public.espacos where id = eid;
    delete from public.historico_espaco where espaco_id = eid;
  end if;

  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.excluir_minha_conta() from public, anon;
grant execute on function public.excluir_minha_conta() to authenticated;

notify pgrst, 'reload schema';
