-- Libera a categoria Compras (cartão de crédito, com parcelas) nos gastos do espaço compartilhado.
-- Rode uma vez no SQL Editor do Supabase. Não apaga nem muda nenhum gasto.

alter table public.gastos drop constraint if exists gastos_categoria_espaco_ck;
alter table public.gastos add constraint gastos_categoria_espaco_ck
  check (espaco_id is null or categoria in ('Boleto', 'Assinatura', 'Mercado', 'Compras'));