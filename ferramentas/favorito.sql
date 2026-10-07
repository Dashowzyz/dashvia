alter table public.perfis add column if not exists banco_favorito text;
notify pgrst, 'reload schema';
