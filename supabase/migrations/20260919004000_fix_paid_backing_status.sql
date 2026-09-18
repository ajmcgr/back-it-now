-- Correct the finalized backing state to the existing paid enum value.
do $fix$
declare ddl text;
begin
  select pg_get_functiondef(p.oid) into ddl
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'finalize_stripe_checkout';
  execute replace(ddl, '''succeeded''', '''paid''');
end $fix$;
