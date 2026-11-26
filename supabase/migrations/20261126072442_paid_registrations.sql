begin;
alter table public.orders add column if not exists registration jsonb not null default '{}';
create or replace function public.academy_ecpay_stage_register(p_user uuid,p_request_key text,p_note text default '',p_registration jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare r jsonb;reg jsonb;existing public.orders%rowtype;needs_registration boolean;
begin
 if not exists(select 1 from public.user_roles where user_id=p_user and role='admin') then raise exception '測試付款僅供管理者使用。' using errcode='42501';end if;
 if jsonb_typeof(p_registration) is distinct from 'object' or octet_length(p_registration::text)>2000 then raise exception '報名資料格式不正確。';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 select * into existing from public.orders where user_id=p_user and request_key=p_request_key;
 if found then return public.academy_ecpay_stage_create(p_user,p_request_key,p_note);end if;
 select exists(select 1 from public.cart x join public.catalog c on c.id=x.product_id where x.user_id=p_user and c.group_name in ('課程類','活動類')) into needs_registration;
 reg:=jsonb_build_object('name',trim(coalesce(p_registration->>'name','')),'phone',trim(coalesce(p_registration->>'phone','')),'bike',trim(coalesce(p_registration->>'bike','')));
 if char_length(reg->>'name')>60 or char_length(reg->>'phone')>25 or char_length(reg->>'bike')>100 then raise exception '報名資料過長。';end if;
 if needs_registration then
  if jsonb_typeof(p_registration->'name') is distinct from 'string' or jsonb_typeof(p_registration->'phone') is distinct from 'string' or jsonb_typeof(p_registration->'bike') is distinct from 'string' then raise exception '請填寫報名姓名、有效手機與自備車款。';end if;
  if char_length(reg->>'name')<1 or regexp_replace(reg->>'phone','[ ()-]','','g')!~'^\+?[0-9]{8,15}$' or char_length(reg->>'bike')<1 then raise exception '請填寫報名姓名、有效手機與自備車款。';end if;
  if exists(select 1 from public.cart x join public.catalog c on c.id=x.product_id where x.user_id=p_user and c.group_name in ('課程類','活動類') and x.qty<>1) then raise exception '課程與活動每個會員每項限報名一位，請將數量設為 1。';end if;
 end if;
 r:=public.academy_ecpay_stage_create(p_user,p_request_key,p_note);
 update public.orders set registration=case when needs_registration then reg else '{}'::jsonb end where id=(r->'order'->>'id')::uuid;
 select to_jsonb(o) into r from public.orders o where o.id=(r->'order'->>'id')::uuid;
 return jsonb_build_object('order',r,'payment',(select to_jsonb(t) from public.ecpay_transactions t where t.order_id=(r->>'id')::uuid));
end$$;
revoke all on function public.academy_ecpay_stage_register(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.academy_ecpay_stage_register(uuid,text,text,jsonb) to service_role;

create or replace function public.academy_paid_registrations(p_kind text,p_test boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.is_academy_admin() then raise exception '此功能僅供管理者使用。' using errcode='42501';end if;
 if p_kind not in ('課程類','活動類') or p_kind is null then raise exception '報名分類不正確。';end if;
 return jsonb_build_object('rows',(select coalesce(jsonb_agg(entry order by paid_at desc,order_id),'[]') from (
 select o.id as order_id,t.updated_at as paid_at,jsonb_build_object(
 'orderId',o.id,'memberId',p.id,'memberName',p.name,'email',p.email,
 'name',coalesce(nullif(o.registration->>'name',''),p.name),'phone',coalesce(o.registration->>'phone',''),'bike',coalesce(o.registration->>'bike',''),
 'missingDetails',coalesce(o.registration->>'phone','')='' or coalesce(o.registration->>'bike','')='',
 'productId',item->>'id','productName',item->>'name','category',item->>'category','quantity',item->'quantity',
 'itemTotal',coalesce((item->>'price')::bigint,0)*coalesce((item->>'quantity')::int,1),'orderTotal',o.total,
 'paidAt',t.updated_at,'paymentStatus',t.status,'environment',t.environment,'tradeNo',t.merchant_trade_no) as entry
 from public.orders o join public.profiles p on p.id=o.user_id join public.ecpay_transactions t on t.order_id=o.id
 cross join lateral jsonb_array_elements(o.items) item
 where item->>'group'=p_kind and o.status<>'cancelled' and t.amount=o.total
 and ((p_test is true and t.environment='stage' and t.status='test_paid') or (p_test is false and t.environment='production' and t.status='paid'))
 ) x));
end$$;
revoke all on function public.academy_paid_registrations(text,boolean) from public,anon;
grant execute on function public.academy_paid_registrations(text,boolean) to authenticated;
commit;
