-- Parcelas pagas "de trás pra frente" (antecipação das últimas parcelas).
-- pagas_ate = quantas parcelas foram pagas do começo; pagas_fim = quantas foram pagas do fim.
-- Rode uma vez no SQL Editor do Neon.
alter table public.gastos add column if not exists pagas_fim integer not null default 0 check (pagas_fim >= 0);