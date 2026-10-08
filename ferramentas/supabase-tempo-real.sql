-- Dashvia: atualização em tempo real dos gastos.
-- Rode uma vez no SQL Editor do Supabase. Pode rodar de novo sem medo.
-- Só avisa as telas abertas de que algo mudou; quem pode ver cada gasto continua sendo decidido pelas regras do banco (RLS).

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'gastos'
  ) then
    alter publication supabase_realtime add table public.gastos;
  end if;
end $$;
