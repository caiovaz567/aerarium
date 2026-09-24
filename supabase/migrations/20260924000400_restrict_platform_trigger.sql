-- Some hosted projects provision this SECURITY DEFINER event trigger in public.
-- Keep automatic RLS on table creation, but remove client execution privileges.
-- Other environments may not have this optional platform helper.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;
