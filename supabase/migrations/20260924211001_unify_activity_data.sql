-- Unify TODO + TOGO -> ACTIVITY; VISITED events -> COMPLETED.

update public.items
set item_type = 'ACTIVITY'
where item_type::text in ('TODO', 'TOGO');

update public.items
set subtype = 'TASK'
where subtype::text in ('VISIT', 'TASK_AT_PLACE', 'TRY', 'TRY_AT_PLACE');

update public.item_events
set event_type = 'COMPLETED'
where event_type::text = 'VISITED';

update public.item_embeddings
set metadata = jsonb_set(
  coalesce(metadata, '{}'::jsonb),
  '{item_type}',
  '"ACTIVITY"'::jsonb,
  true
)
where coalesce(metadata->>'item_type', '') in ('TODO', 'TOGO');
