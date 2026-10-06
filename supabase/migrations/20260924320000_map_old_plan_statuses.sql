update public.items
set plan_status = 'PLANNING'
where plan_status::text in ('SAVED', 'PLANNED');
