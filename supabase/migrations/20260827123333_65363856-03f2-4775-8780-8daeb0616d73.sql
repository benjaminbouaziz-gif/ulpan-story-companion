CREATE TABLE public.admin_login_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email_hash text,
  ip_hash text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT ALL ON public.admin_login_attempts TO service_role;
ALTER TABLE public.admin_login_attempts ENABLE ROW LEVEL SECURITY;
CREATE INDEX admin_login_attempts_created_at_idx ON public.admin_login_attempts (created_at);
CREATE INDEX admin_login_attempts_email_hash_idx ON public.admin_login_attempts (email_hash);
CREATE INDEX admin_login_attempts_ip_hash_idx ON public.admin_login_attempts (ip_hash);
DELETE FROM public.events WHERE kind = 'admin_login_failed';