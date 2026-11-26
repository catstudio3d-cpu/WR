begin;
alter table public.ecpay_transactions add column if not exists method text not null default 'Credit' check(method in ('Credit','ATM','WebATM','CVS','BARCODE'));
alter table public.ecpay_transactions add column if not exists payment_info jsonb not null default '{}';
alter table public.ecpay_transactions add column if not exists expires_at bigint;
create or replace function public.academy_ecpay_stage_order(p_user uuid,p_request_key text,p_note text default '',p_registration jsonb default '{}',p_method text default 'Credit')
returns jsonb language plpgsql security definer set search_path='' as $$
declare r jsonb;t public.ecpay_transactions%rowtype;minimum integer;maximum integer;
begin
 if p_method not in ('Credit','ATM','WebATM','CVS','BARCODE') or p_method is null then raise exception '付款方式不正確。';end if;
 if not exists(select 1 from public.user_roles where user_id=p_user and role='admin') then raise exception '測試付款僅供管理者使用。' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 select x.* into t from public.ecpay_transactions x join public.orders o on o.id=x.order_id where o.user_id=p_user and o.request_key=p_request_key;
 if found then
  if t.method<>p_method then raise exception '此訂單的付款方式已固定，請查看會員訂單紀錄。';end if;
  return public.academy_ecpay_stage_register(p_user,p_request_key,p_note,p_registration);
 end if;
 r:=public.academy_ecpay_stage_register(p_user,p_request_key,p_note,p_registration);
 minimum:=case p_method when 'Credit' then 6 when 'CVS' then 34 when 'BARCODE' then 18 else 16 end;
 maximum:=case p_method when 'Credit' then 200000 when 'CVS' then 6000 when 'BARCODE' then 20000 else 49999 end;
 if (r->'payment'->>'amount')::bigint not between minimum and maximum then raise exception '訂單金額超出此付款方式的限制。';end if;
 update public.ecpay_transactions set method=p_method where id=(r->'payment'->>'id')::uuid returning * into t;
 return jsonb_build_object('order',r->'order','payment',to_jsonb(t));
end$$;
revoke all on function public.academy_ecpay_stage_order(uuid,text,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.academy_ecpay_stage_order(uuid,text,text,jsonb,text) to service_role;

create or replace function public.academy_ecpay_stage_info(p_trade text,p_merchant text,p_amount bigint,p_method text,p_info jsonb,p_expires bigint,p_fingerprint text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.ecpay_transactions%rowtype;
begin
 select * into t from public.ecpay_transactions where merchant_trade_no=p_trade for update;
 if not found or t.merchant_id<>p_merchant or t.amount<>p_amount or t.method<>p_method or p_method not in ('ATM','CVS','BARCODE') then raise exception '取號交易資料不符。';end if;
 if jsonb_typeof(p_info) is distinct from 'object' or p_info='{}'::jsonb or octet_length(p_info::text)>1500 or p_expires is null or p_expires<0 then raise exception '取號資訊不正確。';end if;
 if t.payment_info<>'{}'::jsonb and t.payment_info<>p_info then raise exception '此交易已保存不同的取號資料。';end if;
 insert into public.ecpay_events(transaction_id,fingerprint,source,rtn_code,simulated) values(t.id,p_fingerprint,'notify','issued',false) on conflict(fingerprint) do nothing;
 update public.ecpay_transactions set payment_info=p_info,expires_at=p_expires where id=t.id returning * into t;
 return to_jsonb(t);
end$$;
revoke all on function public.academy_ecpay_stage_info(text,text,bigint,text,jsonb,bigint,text) from public,anon,authenticated;
grant execute on function public.academy_ecpay_stage_info(text,text,bigint,text,jsonb,bigint,text) to service_role;
commit;
