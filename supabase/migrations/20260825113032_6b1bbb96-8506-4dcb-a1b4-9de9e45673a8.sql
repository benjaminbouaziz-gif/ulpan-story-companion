-- Ces deux tables ne sont touchées que par le serveur. On l'écrit noir sur blanc.
CREATE POLICY "email_signups: aucun accès client" ON public.email_signups
  FOR ALL TO authenticated, anon USING (false) WITH CHECK (false);
CREATE POLICY "access_codes: aucun accès client" ON public.access_codes
  FOR ALL TO authenticated, anon USING (false) WITH CHECK (false);

REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM authenticated, anon, public;