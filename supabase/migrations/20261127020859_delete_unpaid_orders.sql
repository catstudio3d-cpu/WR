begin;
alter table public.orders add column deleted_at bigint;
alter table public.orders add column deleted_by uuid references auth.users(id);
alter table public.orders add column inventory_released boolean not null default false;
alter table public.orders add column payment_review_required boolean not null default false;
grant select on public.orders to service_role;

create or replace function public.academy_delete_unpaid_order(p_actor uuid,p_order uuid,p_verification text default '',p_verified_trade text default '',p_checked_at bigint default 0)
returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.orders%rowtype;t public.ecpay_transactions%rowtype;item jsonb;stamp bigint:=extract(epoch from now())::bigint;
begin
 if not exists(select 1 from public.user_roles where user_id=p_actor and role='admin') then raise exception '僅管理者可刪除未付款訂單。' using errcode='42501';end if;
 -- Same locking order as payment callbacks: transaction, then order.
 select * into t from public.ecpay_transactions where order_id=p_order for update;
 select * into o from public.orders where id=p_order for update;
 if not found then raise exception '找不到訂單。';end if;
 if o.deleted_at is not null then return jsonb_build_object('deleted',true,'alreadyDeleted',true,'orderId',o.id);end if;
 if o.status='completed' or o.payment_status in ('paid','test_paid') or t.status in ('paid','test_paid') then raise exception '已付款或已完成訂單不可直接刪除；請先處理退款與對帳。';end if;
 if o.payment_environment='production' and (t.id is null or p_verification not in ('unpaid','not_created') or p_verification is null or p_verified_trade is distinct from t.merchant_trade_no or p_checked_at is null or p_checked_at not between stamp-120 and stamp+5) then raise exception '尚未完成綠界未付款查核，未釋放名額。';end if;
 if o.status<>'cancelled' and not o.inventory_released then
  for item in select value from jsonb_array_elements(o.items) order by value->>'id' loop
   if coalesce((item->>'demo')::boolean,true)=false then
    update public.catalog set stock=stock+(item->>'quantity')::integer,revision=revision+1 where id=item->>'id';
   end if;
  end loop;
 end if;
 update public.orders set status='cancelled',deleted_at=stamp,deleted_by=p_actor,inventory_released=true where id=o.id;
 insert into public.audit(actor,action,object_id,detail) values(p_actor,'order.delete_unpaid',o.id::text,'名額／庫存已釋放；付款查核：'||coalesce(nullif(p_verification,''),'非正式金流'));
 return jsonb_build_object('deleted',true,'alreadyDeleted',false,'orderId',o.id);
end$$;
revoke all on function public.academy_delete_unpaid_order(uuid,uuid,text,text,bigint) from public,anon,authenticated;
grant execute on function public.academy_delete_unpaid_order(uuid,uuid,text,text,bigint) to service_role;

create or replace function public.academy_production_order_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if old.deleted_at is not null and new.status<>'cancelled' then raise exception '已刪除訂單不可重新開啟。';end if;
 if old.payment_environment='production' and new.status is distinct from old.status then
  if new.status in ('processing','completed') and old.payment_status<>'paid' then raise exception '尚未確認收款，不可處理或完成訂單。';end if;
  if new.status='cancelled' and old.payment_status<>'paid' and not(new.deleted_at is not null and new.inventory_released and current_user in ('postgres','service_role')) then raise exception '未付款訂單請使用刪除並釋放名額功能。';end if;
 end if;
 return new;
end$$;
revoke all on function public.academy_production_order_guard() from public,anon,authenticated;

-- Late payment stays cancelled and is excluded from enrollment, but money is recorded.
create or replace function public.academy_deleted_payment_review() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.deleted_at is not null and new.payment_status='paid' then
  new.status:='cancelled';new.payment_review_required:=true;
 end if;
 return new;
end$$;
revoke all on function public.academy_deleted_payment_review() from public,anon,authenticated;
create trigger academy_deleted_payment_review before update of payment_status on public.orders for each row execute function public.academy_deleted_payment_review();
commit;
