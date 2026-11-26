-- 綠界 AIO 測試串接；不處理真實收款，不扣庫存，不核發證書。
begin;
alter table public.orders add column if not exists payment_status text not null default 'not_requested';
alter table public.orders add column if not exists payment_environment text;
create table if not exists public.ecpay_transactions(
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null unique references public.orders(id),
 user_id uuid not null references auth.users(id),
 merchant_trade_no text not null unique check(merchant_trade_no ~ '^[A-Za-z0-9]{1,20}$'),
 merchant_id text not null default '3002607' check(merchant_id='3002607'),
 environment text not null default 'stage' check(environment='stage'),
 amount bigint not null check(amount between 1 and 200000),
 status text not null default 'pending' check(status in ('pending','test_paid','failed','simulated')),
 trade_no text not null default '', payment_date text not null default '',
 query_checked_at bigint not null default 0,
 created_at bigint not null default extract(epoch from now())::bigint,
 updated_at bigint not null default extract(epoch from now())::bigint
);
create table if not exists public.ecpay_events(
 id bigint generated always as identity primary key,
 transaction_id uuid not null references public.ecpay_transactions(id),
 fingerprint text not null unique check(fingerprint ~ '^[a-f0-9]{64}$'),
 source text not null check(source in ('notify','query')),
 rtn_code text not null, simulated boolean not null,
 created_at bigint not null default extract(epoch from now())::bigint
);
alter table public.ecpay_transactions enable row level security;
alter table public.ecpay_events enable row level security;
revoke all on public.ecpay_transactions,public.ecpay_events from public,anon,authenticated;
grant select on public.ecpay_transactions,public.ecpay_events to authenticated;
grant all on public.ecpay_transactions,public.ecpay_events to service_role;
grant usage,select on sequence public.ecpay_events_id_seq to service_role;
drop policy if exists ecpay_transaction_read on public.ecpay_transactions;
create policy ecpay_transaction_read on public.ecpay_transactions for select to authenticated
using(user_id=(select auth.uid()) or (select public.is_academy_admin()));
drop policy if exists ecpay_event_read on public.ecpay_events;
create policy ecpay_event_read on public.ecpay_events for select to authenticated
using((select public.is_academy_admin()));
create index if not exists ecpay_transactions_user_created on public.ecpay_transactions(user_id,created_at desc);
create index if not exists ecpay_events_transaction on public.ecpay_events(transaction_id);

create or replace function public.academy_ecpay_stage_create(p_user uuid,p_request_key text,p_note text default '')
returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.orders%rowtype;t public.ecpay_transactions%rowtype;p public.catalog%rowtype;
 q integer;items jsonb:='[]';total bigint:=0;
begin
 if not exists(select 1 from public.user_roles where user_id=p_user and role='admin') then
  raise exception '測試付款僅供學院管理者使用。' using errcode='42501';
 end if;
 if coalesce(p_request_key,'')!~'^[A-Za-z0-9-]{16,80}$' or char_length(coalesce(p_note,''))>500 then raise exception '訂單資料不正確。';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 select * into o from public.orders where user_id=p_user and request_key=p_request_key;
 if found then
  select * into t from public.ecpay_transactions where order_id=o.id;
  if not found then raise exception '此訂單不是綠界測試訂單。';end if;
  return jsonb_build_object('order',to_jsonb(o),'payment',to_jsonb(t));
 end if;
 if (select count(*) from public.ecpay_transactions where user_id=p_user and created_at>extract(epoch from now())::bigint-3600)>=20 then raise exception '測試訂單建立過於頻繁，請稍後再試。';end if;
 for p in select c.* from public.catalog c join public.cart x on x.product_id=c.id where x.user_id=p_user order by c.id for update of c loop
  select qty into q from public.cart where user_id=p_user and product_id=p.id;
  if not p.active or p.price<=0 or q not between 1 and 20 then raise exception '購物車有未上架商品或數量不正確。';end if;
  -- 測試快照固定 demo=true，避免既有取消流程增加真實庫存。
  items:=items||jsonb_build_array(public.academy_product(p)||jsonb_build_object('quantity',q,'demo',true));
  total:=total+p.price::bigint*q;
 end loop;
 if jsonb_array_length(items)=0 or total not between 1 and 200000 then raise exception '購物車無商品，或測試金額超出範圍。';end if;
 insert into public.orders(user_id,request_key,items,total,kind,note,payment_status,payment_environment)
 values(p_user,p_request_key,items,total,'reservation',coalesce(p_note,''),'pending','stage') returning * into o;
 insert into public.ecpay_transactions(order_id,user_id,merchant_trade_no,amount)
 values(o.id,p_user,'WR'||substring(replace(gen_random_uuid()::text,'-',''),1,18),total) returning * into t;
 delete from public.cart where user_id=p_user;
 insert into public.audit(actor,action,object_id,detail) values(p_user,'payment.stage.create',o.id::text,'綠界測試，不扣庫存');
 return jsonb_build_object('order',to_jsonb(o),'payment',to_jsonb(t));
end$$;
revoke all on function public.academy_ecpay_stage_create(uuid,text,text) from public,anon,authenticated;
grant execute on function public.academy_ecpay_stage_create(uuid,text,text) to service_role;

create or replace function public.academy_ecpay_stage_apply(
 p_trade text,p_merchant text,p_amount bigint,p_status text,p_trade_no text,
 p_date text,p_rtn_code text,p_simulated boolean,p_verified boolean,p_source text,p_fingerprint text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.ecpay_transactions%rowtype;event_id bigint;
begin
 select * into t from public.ecpay_transactions where merchant_trade_no=p_trade for update;
 if not found or t.merchant_id<>p_merchant or t.amount<>p_amount then raise exception '交易或金額不符。';end if;
 if p_status not in ('pending','test_paid','failed','simulated') or p_status is null or
 (p_status='test_paid' and (p_verified is distinct from true or p_simulated is distinct from false)) then raise exception '付款驗證未完成。';end if;
 if char_length(coalesce(p_trade_no,''))>20 or char_length(coalesce(p_date,''))>20 or char_length(coalesce(p_rtn_code,''))>20 then raise exception '交易資料不正確。';end if;
 insert into public.ecpay_events(transaction_id,fingerprint,source,rtn_code,simulated)
 values(t.id,p_fingerprint,p_source,p_rtn_code,p_simulated) on conflict(fingerprint) do nothing returning id into event_id;
 if event_id is null then return to_jsonb(t);end if;
 if t.status<>'test_paid' then
  update public.ecpay_transactions set status=p_status,trade_no=coalesce(p_trade_no,''),payment_date=coalesce(p_date,''),updated_at=extract(epoch from now())::bigint where id=t.id returning * into t;
  update public.orders set payment_status=t.status where id=t.order_id;
 end if;
 insert into public.audit(actor,action,object_id,detail) values(t.user_id,'payment.stage.'||p_source,t.order_id::text,t.status);
 return to_jsonb(t);
end$$;
revoke all on function public.academy_ecpay_stage_apply(text,text,bigint,text,text,text,text,boolean,boolean,text,text) from public,anon,authenticated;
grant execute on function public.academy_ecpay_stage_apply(text,text,bigint,text,text,text,text,boolean,boolean,text,text) to service_role;
commit;
