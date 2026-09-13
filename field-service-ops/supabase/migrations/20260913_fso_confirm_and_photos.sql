-- Confirm online request → customer + unassigned job (member-only)
create or replace function public.confirm_service_request(p_request_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.service_requests%rowtype;
  v_customer uuid;
  v_job uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into v_req from public.service_requests where id = p_request_id for update;
  if not found then
    raise exception 'request not found';
  end if;
  if not public.is_shop_member(v_req.shop_id) then
    raise exception 'forbidden';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'request not pending';
  end if;

  select id into v_customer
  from public.customers
  where shop_id = v_req.shop_id
    and phone = v_req.contact_phone
    and name = v_req.contact_name
  limit 1;

  if v_customer is null then
    insert into public.customers (shop_id, name, phone, email, address)
    values (v_req.shop_id, v_req.contact_name, v_req.contact_phone, '', v_req.address)
    returning id into v_customer;
  end if;

  insert into public.jobs (
    shop_id, customer_id, trade, description, address, preferred_window,
    status, payment_status
  ) values (
    v_req.shop_id, v_customer, v_req.trade, v_req.description, v_req.address,
    v_req.preferred_window, 'unassigned', 'unpaid'
  ) returning id into v_job;

  update public.service_requests set status = 'confirmed' where id = v_req.id;
  return v_job;
end;
$$;

grant execute on function public.confirm_service_request(uuid) to authenticated;

-- Private job photo bucket (path: {shop_id}/{job_id}/{filename})
insert into storage.buckets (id, name, public)
values ('job-photos', 'job-photos', false)
on conflict (id) do nothing;

drop policy if exists job_photos_select on storage.objects;
drop policy if exists job_photos_insert on storage.objects;
drop policy if exists job_photos_update on storage.objects;
drop policy if exists job_photos_delete on storage.objects;

create policy job_photos_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'job-photos'
    and public.is_shop_member((string_to_array(name, '/'))[1]::uuid)
  );

create policy job_photos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'job-photos'
    and public.is_shop_member((string_to_array(name, '/'))[1]::uuid)
  );

create policy job_photos_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'job-photos'
    and public.is_shop_member((string_to_array(name, '/'))[1]::uuid)
  );

create policy job_photos_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'job-photos'
    and public.is_shop_member((string_to_array(name, '/'))[1]::uuid)
  );
