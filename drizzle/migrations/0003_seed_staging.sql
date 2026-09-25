CREATE TABLE IF NOT EXISTS public.seed_scripts (id text PRIMARY KEY, sql text NOT NULL);
GRANT ALL ON public.seed_scripts TO service_role;
ALTER TABLE public.seed_scripts ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.seed_scripts IS 'Internal: one-off demo data loading, service role only';