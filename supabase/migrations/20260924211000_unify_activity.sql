-- Add ACTIVITY enum value. Data rewrite runs in the next migration because
-- PostgreSQL cannot use a new enum value before this transaction commits.

do $$ begin
  alter type item_type add value if not exists 'ACTIVITY';
exception
  when duplicate_object then null;
end $$;
