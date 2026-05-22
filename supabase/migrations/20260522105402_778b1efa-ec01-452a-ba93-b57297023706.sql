-- Remove funil_config from realtime publication to prevent leaking
-- PIX keys / payment links to patients who have SELECT access on the row.
-- Therapists can still query the table normally; only realtime streaming stops.
ALTER PUBLICATION supabase_realtime DROP TABLE public.funil_config;