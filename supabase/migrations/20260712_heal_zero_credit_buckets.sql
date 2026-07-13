-- ============================================================================
-- 20260712_heal_zero_credit_buckets.sql
-- ----------------------------------------------------------------------------
-- ensure_credit_buckets previously only updated monthly_grant on conflict,
-- leaving balance=0 / grant=0 rows stuck (manual Pro or incomplete webhook).
-- On conflict, top up balance when the existing grant was 0 (or null).
-- Safe to re-run. Does not refill users who already used a normal grant.
-- ============================================================================

create or replace function public.ensure_credit_buckets(
  p_user_id uuid,
  p_skip_grant integer default 50,
  p_avm_grant  integer default 200
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.data_credits (user_id, credit_type, balance, monthly_grant)
  values
    (p_user_id, 'skip_trace', p_skip_grant, p_skip_grant),
    (p_user_id, 'avm',        p_avm_grant,  p_avm_grant)
  on conflict (user_id, credit_type) do update
    set monthly_grant = excluded.monthly_grant,
        balance = case
          when coalesce(public.data_credits.monthly_grant, 0) = 0
               and coalesce(public.data_credits.balance, 0) = 0
            then excluded.balance
          else public.data_credits.balance
        end,
        updated_at = now();
end;
$$;
