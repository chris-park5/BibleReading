-- Returns required reading item counts per day for a given plan.
-- Purpose: avoid downloading all schedule rows just to compute completedDays.
--
-- Signature is stable for client RPC usage.

create or replace function public.get_schedule_item_counts_by_day(p_plan_id uuid)
returns table(day integer, required_count integer)
language plpgsql
security invoker
as $$
declare
  v_is_custom boolean;
  v_preset_id text;
begin
  select is_custom, preset_id
    into v_is_custom, v_preset_id
  from public.plans
  where id = p_plan_id;

  if not found then
    return;
  end if;

  if v_is_custom then
    return query
    select s.day::integer as day, count(*)::integer as required_count
    from public.plan_schedules s
    where s.plan_id = p_plan_id
    group by s.day
    order by s.day;
  else
    if v_preset_id is null or length(v_preset_id) = 0 then
      return;
    end if;

    return query
    select s.day::integer as day, count(*)::integer as required_count
    from public.preset_schedules s
    where s.preset_id = v_preset_id
    group by s.day
    order by s.day;
  end if;
end;
$$;
