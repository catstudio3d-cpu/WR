begin;
alter table public.ecpay_transactions drop constraint ecpay_transactions_environment_check;
alter table public.ecpay_transactions drop constraint ecpay_transactions_merchant_id_check;
alter table public.ecpay_transactions drop constraint ecpay_transactions_status_check;
alter table public.ecpay_transactions add constraint ecpay_environment_merchant check((environment='stage' and merchant_id='3002607') or (environment='production' and merchant_id='3096502'));
alter table public.ecpay_transactions add constraint ecpay_environment_status check((environment='stage' and status in ('pending','test_paid','failed','simulated')) or (environment='production' and status in ('pending','paid','failed','simulated')));

create or replace function public.academy_ecpay_production_order(p_user uuid,p_request_key text,p_note text default '',p_registration jsonb default '{}',p_method text default 'Credit',p_merchant text default '')
returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.orders%rowtype;t public.ecpay_transactions%rowtype;p public.catalog%rowtype;q integer;items jsonb:='[]';total bigint:=0;reg jsonb;needs_registration boolean:=false;minimum integer;maximum integer;
begin
 if p_merchant is distinct from '3096502' or not exists(select 1 from public.profiles where id=p_user) then raise exception '正式商店或會員資料不正確。';end if;
 if p_method is null or p_method not in ('Credit','ATM','WebATM','CVS','BARCODE') or coalesce(p_request_key,'')!~'^[A-Za-z0-9-]{16,80}$' or char_length(coalesce(p_note,''))>500 then raise exception '訂單資料不正確。';end if;
 if jsonb_typeof(p_registration) is distinct from 'object' or octet_length(p_registration::text)>2000 then raise exception '報名資料不正確。';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 select * into o from public.orders where user_id=p_user and request_key=p_request_key;
 if found then
  select * into t from public.ecpay_transactions where order_id=o.id;
  if not found or t.environment<>'production' or t.method<>p_method or o.status='cancelled' then raise exception '此訂單已處理，請查看會員紀錄。';end if;
  return jsonb_build_object('order',to_jsonb(o),'payment',to_jsonb(t));
 end if;
 if (select count(*) from public.ecpay_transactions where user_id=p_user and created_at>extract(epoch from now())::bigint-3600)>=20 then raise exception '訂單建立過於頻繁，請稍後再試。';end if;
 for p in select c.* from public.catalog c join public.cart x on x.product_id=c.id where x.user_id=p_user order by c.id for update of c loop
  select qty into q from public.cart where user_id=p_user and product_id=p.id;
  if not p.active or p.is_demo or p.price<=0 or q not between 1 and 20 or p.stock is null or p.stock<q then raise exception '商品未開放正式購買或名額／庫存不足。';end if;
  if p.group_name in ('課程類','活動類') then
   needs_registration:=true;
   if q<>1 then raise exception '課程與活動每項限報名一位。';end if;
   if exists(select 1 from public.orders old join public.ecpay_transactions tx on tx.order_id=old.id cross join lateral jsonb_array_elements(old.items) item where old.user_id=p_user and old.status<>'cancelled' and tx.environment='production' and tx.status in ('pending','paid','simulated') and item->>'id'=p.id) then raise exception '已有此課程／活動的待付款或已繳費訂單，請先查看會員訂單。';end if;
  end if;
  items:=items||jsonb_build_array(public.academy_product(p)||jsonb_build_object('quantity',q));
  total:=total+p.price::bigint*q;
  update public.catalog set stock=stock-q,revision=revision+1 where id=p.id;
 end loop;
 minimum:=case p_method when 'Credit' then 6 when 'CVS' then 34 when 'BARCODE' then 18 else 16 end;
 maximum:=case p_method when 'Credit' then 200000 when 'CVS' then 6000 when 'BARCODE' then 20000 else 49999 end;
 if jsonb_array_length(items)=0 or total not between minimum and maximum then raise exception '購物車沒有商品或金額不適用此付款方式。';end if;
 reg:=jsonb_build_object('name',trim(coalesce(p_registration->>'name','')),'phone',trim(coalesce(p_registration->>'phone','')),'bike',trim(coalesce(p_registration->>'bike','')));
 if needs_registration and (jsonb_typeof(p_registration->'name') is distinct from 'string' or jsonb_typeof(p_registration->'phone') is distinct from 'string' or jsonb_typeof(p_registration->'bike') is distinct from 'string' or char_length(reg->>'name') not between 1 and 60 or char_length(reg->>'phone')>25 or regexp_replace(reg->>'phone','[ ()-]','','g')!~'^\+?[0-9]{8,15}$' or char_length(reg->>'bike') not between 1 and 100) then raise exception '請填寫報名姓名、有效手機與自備車款。';end if;
 insert into public.orders(user_id,request_key,items,total,kind,note,payment_status,payment_environment,registration)
 values(p_user,p_request_key,items,total,'reservation',coalesce(p_note,''),'pending','production',case when needs_registration then reg else '{}'::jsonb end) returning * into o;
 insert into public.ecpay_transactions(order_id,user_id,merchant_trade_no,merchant_id,environment,amount,method)
 values(o.id,p_user,'WP'||substring(replace(gen_random_uuid()::text,'-',''),1,18),p_merchant,'production',total,p_method) returning * into t;
 delete from public.cart where user_id=p_user;
 insert into public.audit(actor,action,object_id,detail) values(p_user,'payment.production.create',o.id::text,'已保留名額／庫存，付款結果待確認');
 return jsonb_build_object('order',to_jsonb(o),'payment',to_jsonb(t));
end$$;
revoke all on function public.academy_ecpay_production_order(uuid,text,text,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.academy_ecpay_production_order(uuid,text,text,jsonb,text,text) to service_role;

create or replace function public.academy_ecpay_production_apply(p_trade text,p_merchant text,p_amount bigint,p_status text,p_trade_no text,p_date text,p_rtn_code text,p_simulated boolean,p_verified boolean,p_source text,p_fingerprint text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.ecpay_transactions%rowtype;event_id bigint;
begin
 select * into t from public.ecpay_transactions where merchant_trade_no=p_trade for update;
 if not found or t.environment<>'production' or t.merchant_id<>p_merchant or t.amount<>p_amount then raise exception '正式交易或金額不符。';end if;
 if p_status is null or p_status not in ('pending','paid','failed','simulated') or (p_status='paid' and (p_verified is distinct from true or p_simulated is distinct from false or p_source is distinct from 'query' or coalesce(p_trade_no,'')='')) then raise exception '正式付款尚未驗證。';end if;
 if char_length(coalesce(p_trade_no,''))>20 or char_length(coalesce(p_date,''))>20 or char_length(coalesce(p_rtn_code,''))>20 then raise exception '交易資料不正確。';end if;
 insert into public.ecpay_events(transaction_id,fingerprint,source,rtn_code,simulated) values(t.id,p_fingerprint,p_source,p_rtn_code,p_simulated) on conflict(fingerprint) do nothing returning id into event_id;
 if event_id is null then return to_jsonb(t);end if;
 if t.status<>'paid' then
  update public.ecpay_transactions set status=p_status,trade_no=coalesce(p_trade_no,''),payment_date=coalesce(p_date,''),updated_at=extract(epoch from now())::bigint where id=t.id returning * into t;
  update public.orders set payment_status=t.status where id=t.order_id;
 end if;
 insert into public.audit(actor,action,object_id,detail) values(t.user_id,'payment.production.'||p_source,t.order_id::text,t.status);
 return to_jsonb(t);
end$$;
revoke all on function public.academy_ecpay_production_apply(text,text,bigint,text,text,text,text,boolean,boolean,text,text) from public,anon,authenticated;
grant execute on function public.academy_ecpay_production_apply(text,text,bigint,text,text,text,text,boolean,boolean,text,text) to service_role;

-- 防止舊測試函式操作正式交易；正式訂單保留庫存期間不得直接取消。
create or replace function public.academy_production_order_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if old.payment_environment='production' and new.status is distinct from old.status then
  if new.status in ('processing','completed') and old.payment_status<>'paid' then raise exception '尚未確認收款，不可處理或完成訂單。';end if;
  if new.status='cancelled' and old.payment_status<>'paid' then raise exception '待付款訂單仍保留名額，須先核對綠界交易後由學院處理，不可直接取消。';end if;
 end if;
 return new;
end$$;
revoke all on function public.academy_production_order_guard() from public,anon,authenticated;
create trigger academy_production_order_guard before update on public.orders for each row execute function public.academy_production_order_guard();
create or replace function public.academy_ecpay_stage_apply(
 p_trade text,p_merchant text,p_amount bigint,p_status text,p_trade_no text,
 p_date text,p_rtn_code text,p_simulated boolean,p_verified boolean,p_source text,p_fingerprint text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.ecpay_transactions%rowtype;event_id bigint;
begin
 select * into t from public.ecpay_transactions where merchant_trade_no=p_trade for update;
 if not found or t.environment<>'stage' or t.merchant_id<>p_merchant or t.amount<>p_amount then raise exception '交易或金額不符。';end if;
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

-- 舊詢價／預約入口不能繞過正式金流建立保留庫存的訂單。
do $$declare definition text;begin
 select pg_get_functiondef('public.academy_request(text,jsonb)'::regprocedure) into definition;
 if strpos(definition,'請使用購物車正式付款入口。')=0 then
  definition:=replace(definition, 'if p_action=''catalog'' then', 'if p_action=''checkout'' then raise exception ''請使用購物車正式付款入口。'';end if; if p_action=''catalog'' then');
 end if;
 execute definition;
end$$;
commit;
