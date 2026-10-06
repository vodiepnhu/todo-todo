-- Ensure folders/home tables are usable via PostgREST after M23
grant all on table public.project_folders to anon, authenticated, service_role;
grant all on table public.home_messages to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
notify pgrst, 'reload schema';
