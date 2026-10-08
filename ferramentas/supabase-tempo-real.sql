-- Dashvia: atualização em tempo real (gastos, membros do espaço e histórico).
-- Rode no SQL Editor do Supabase. Pode rodar de novo sem medo (a primeira versão só tinha "gastos").
-- Só avisa as telas abertas de que algo mudou; quem pode ver cada coisa continua sendo decidido pelas regras do banco (RLS).

do $$
declare
  tabela text;
begin
  foreach tabela in array array['gastos', 'membros', 'espacos', 'historico_espaco'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = tabela
    ) then
      execute format('alter publication supabase_realtime add table public.%I', tabela);
    end if;
  end loop;
end $$;
