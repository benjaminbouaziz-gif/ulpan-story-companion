REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

REVOKE ALL ON public.content_versions FROM anon;
CREATE POLICY "Admins read content versions" ON public.content_versions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'));

REVOKE ALL ON public.events FROM anon, authenticated;
CREATE POLICY "Admins read events" ON public.events
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));