alter table public.gastos add column if not exists pagas_ate integer not null default 0 check (pagas_ate >= 0);
