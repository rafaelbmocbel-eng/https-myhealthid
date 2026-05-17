CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'whatsapp-auto-confirm-diario',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://mgdzlzpzjpnswpqdtylz.supabase.co/functions/v1/whatsapp-auto-confirm',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1nZHpsenB6anBuc3dwcWR0eWx6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NjM5MzIsImV4cCI6MjA4NzAzOTkzMn0.zAu_ZC8ne3X-Dj6cXEchbJdfKBRfnFTx2pqo5Cef_7c"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);