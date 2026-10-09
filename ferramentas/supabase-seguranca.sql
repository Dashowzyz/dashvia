-- ===== Dashvia: endurecimento de segurança do banco =====
-- Rode DEPOIS do supabase.sql e do supabase-compartilhado.sql. Cole no SQL Editor do Supabase e clique em Run.
-- Pode rodar de novo sem medo. Não apaga nem muda nenhum dado.
--
-- O que faz:
--  - limita o tamanho dos textos (ninguém consegue encher o banco pela API com textos gigantes);
--  - a foto do perfil só pode ser uma imagem embutida (data:image/jpeg), nunca um link externo
--    (um link deixaria quem divide o espaço com você ser rastreado pelo IP);
--  - limita os convites ativos por espaço.
--
-- "not valid" = vale para tudo que for criado ou editado daqui para frente; linhas antigas não são reprovadas.

alter table public.perfis drop constraint if exists perfis_tamanho_ck;
alter table public.perfis add constraint perfis_tamanho_ck
  check (char_length(nome) <= 100 and char_length(usuario) <= 50) not valid;

alter table public.perfis drop constraint if exists perfis_foto_ck;
alter table public.perfis add constraint perfis_foto_ck
  check (foto = '' or (foto like 'data:image/jpeg;base64,%' and char_length(foto) <= 150000)) not valid;

alter table public.gastos drop constraint if exists gastos_tamanho_ck;
alter table public.gastos add constraint gastos_tamanho_ck
  check (
    char_length(plataforma) <= 120
    and char_length(categoria) <= 60
    and char_length(banco) <= 60
    and char_length(parcelas) <= 20
  ) not valid;

-- No máximo 10 convites ativos (não usados e não vencidos) por espaço
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
  ativos int;
begin
  if uid is null then raise exception 'NAO_AUTENTICADO'; end if;
  select id into eid from public.espacos where lider_id = uid;
  if eid is null then raise exception 'SO_LIDER'; end if;

  -- limpa os vencidos e os já usados há mais de 30 dias
  delete from public.convites
  where espaco_id = eid
    and (expira_em < now() - interval '1 day' or usado_em < now() - interval '30 days');

  select count(*) into ativos from public.convites
  where espaco_id = eid and usado_por is null and expira_em > now();
  if ativos >= 10 then raise exception 'CONVITES_DEMAIS'; end if;

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

revoke all on function public.gerar_convite() from public, anon;
grant execute on function public.gerar_convite() to authenticated;

notify pgrst, 'reload schema';
