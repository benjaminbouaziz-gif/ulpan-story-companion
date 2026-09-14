ALTER TABLE public.book_pages ADD COLUMN audio_path text;

CREATE POLICY "audios livres lecture editeurs" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'audios-livres'
    AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor')));

CREATE POLICY "audios livres ecriture editeurs" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'audios-livres'
    AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor')));

CREATE POLICY "audios livres maj editeurs" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'audios-livres'
    AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor')))
  WITH CHECK (bucket_id = 'audios-livres'
    AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor')));

CREATE POLICY "audios livres suppression editeurs" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'audios-livres'
    AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor')));