-- Remap TRY subtypes → TODO/TASK equivalents. Enum labels kept (dead values).

update public.items
set
  subtype = 'TASK',
  item_type = 'TODO'
where subtype = 'TRY';

update public.items
set
  subtype = 'TASK_AT_PLACE',
  item_type = 'TODO'
where subtype = 'TRY_AT_PLACE';
