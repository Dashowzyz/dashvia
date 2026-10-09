-- ===== Dashvia: agenda dos avisos push =====
-- Rode DEPOIS de publicar a função avisos-push e de ligar as extensões pg_cron e pg_net
-- (Database > Extensions). Troque SEGREDO_DO_CRON pelo MESMO valor do segredo CRON_SECRET da função.
-- Pode rodar de novo: as agendas antigas são trocadas pelas novas.
--
--  - todo dia às 08:00 de Brasília (11:00 UTC): avisos de boletos e parcelas;
--  - a cada 30 minutos: confere se saiu novidade (só envia entre 08:00 e 21:00 de Brasília).

do $$
begin
  if exists (select 1 from vault.secrets where name = 'cron_secret_avisos') then
    perform vault.update_secret((select id from vault.secrets where name = 'cron_secret_avisos'), 'SEGREDO_DO_CRON');
  else
    perform vault.create_secret('SEGREDO_DO_CRON', 'cron_secret_avisos');
  end if;
end $$;

select cron.unschedule(jobid) from cron.job where jobname in ('avisos-vencimentos', 'avisos-novidades');

select cron.schedule(
  'avisos-vencimentos',
  '0 11 * * *',
  $job$
  select net.http_post(
    url := 'https://xouwjsnfkhegwxhxtmeb.supabase.co/functions/v1/avisos-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret_avisos')
    ),
    body := '{"modo":"vencimentos"}'::jsonb
  );
  $job$
);

select cron.schedule(
  'avisos-novidades',
  '*/30 * * * *',
  $job$
  select net.http_post(
    url := 'https://xouwjsnfkhegwxhxtmeb.supabase.co/functions/v1/avisos-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret_avisos')
    ),
    body := '{"modo":"novidades"}'::jsonb
  );
  $job$
);

-- Para desligar tudo:
-- select cron.unschedule(jobid) from cron.job where jobname in ('avisos-vencimentos', 'avisos-novidades');
