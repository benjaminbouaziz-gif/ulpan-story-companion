CREATE UNIQUE INDEX IF NOT EXISTS book_access_user_book_key
  ON public.book_access(user_id, book_id);