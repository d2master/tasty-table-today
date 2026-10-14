CREATE TABLE IF NOT EXISTS public.login_attempts (
  email text PRIMARY KEY,
  failed_count int NOT NULL DEFAULT 0,
  locked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.login_attempts FROM anon, authenticated;
GRANT ALL ON public.login_attempts TO service_role;