-- Drop unused tables/columns: folders, assignees, notifications (data included).

alter table public.workspaces
  drop column if exists folder_id;

drop table if exists public.project_folders cascade;
drop table if exists public.item_assignees cascade;
drop table if exists public.notifications cascade;
