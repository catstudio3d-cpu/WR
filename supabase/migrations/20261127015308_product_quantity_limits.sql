begin;
alter table public.catalog add column max_per_order integer check(max_per_order between 1 and 1000000);
alter table public.cart drop constraint cart_qty_check;
alter table public.cart add constraint cart_qty_check check(qty between 1 and 1000000);
create or replace function public.academy_product(p public.catalog) returns jsonb language sql immutable set search_path='' as $$select jsonb_build_object('id',p.id,'name',p.name,'group',p.group_name,'category',p.category,'price',p.price,'image',p.image,'description',p.description,'demo',p.is_demo,'stock',p.stock,'active',p.active,'revision',p.revision,'featured',p.featured,'ad_order',p.ad_order,'max_per_order',p.max_per_order)$$;

do $$declare definition text;needle text;
begin
 select pg_get_functiondef('public.academy_request_base(text,jsonb)'::regprocedure) into definition;
 definition:=replace(definition,$old$coalesce(v_item->>'quantity','')!~'^\d{1,2}$'$old$,$new$coalesce(v_item->>'quantity','')!~'^\d{1,7}$'$new$);
 definition:=replace(definition,'v_qty not between 0 and 20','v_qty not between 0 and 1000000');
 definition:=replace(definition,'least(20,v_qty+coalesce((select qty from public.cart where user_id=uid and product_id=v_row.id),0))','v_qty+coalesce((select qty from public.cart where user_id=uid and product_id=v_row.id),0)');
 needle:='if v_qty=0 then delete from public.cart';
 if strpos(definition,needle)=0 then raise exception 'Cart update path changed; migration aborted.';end if;
 definition:=replace(definition,needle,$new$
 if v_qty>1000000 or (v_row.max_per_order is not null and v_qty>v_row.max_per_order) then raise exception '超過此商品每筆訂單的人數／數量上限。';end if;
 if v_qty>0 and not v_row.is_demo and (v_row.stock is null or v_qty>v_row.stock) then raise exception '剩餘名額／庫存不足。';end if;
 if v_qty=0 then delete from public.cart$new$);
 execute definition;

 select pg_get_functiondef('public.academy_request(text,jsonb)'::regprocedure) into definition;
 needle:=$old$if p_action in ('admin.product-create','admin.product') then$old$;
 if strpos(definition,needle)=0 then raise exception 'Product admin path changed; migration aborted.';end if;
 definition:=replace(definition,needle,needle||$new$
 if p_data ? 'max_per_order' and jsonb_typeof(p_data->'max_per_order')<>'null' then
  if jsonb_typeof(p_data->'max_per_order') is distinct from 'number' or coalesce(p_data->>'max_per_order','')!~'^\d{1,7}$' then raise exception '每筆上限需為正整數，或留空不限。';end if;
  if (p_data->>'max_per_order')::integer not between 1 and 1000000 then raise exception '每筆上限需為正整數，或留空不限。';end if;
 end if;
 $new$);
 definition:=replace(definition,'set featured=case when p_data ?',$new$set max_per_order=case when p_data ? 'max_per_order' then (p_data->>'max_per_order')::integer else max_per_order end,featured=case when p_data ?$new$);
 needle:=$old$insert into public.audit(actor,action,object_id) values(uid,'product.create',p_data->>'id');$old$;
 if strpos(definition,needle)=0 then raise exception 'Product creation path changed; migration aborted.';end if;
 definition:=replace(definition,needle,$new$update public.catalog set max_per_order=(p_data->>'max_per_order')::integer where id=p_data->>'id';$new$||needle);
 execute definition;

 select pg_get_functiondef('public.academy_ecpay_production_order(uuid,text,text,jsonb,text,text)'::regprocedure) into definition;
 definition:=replace(definition,'q not between 1 and 20','q not between 1 and 1000000');
 needle:=$old$if q<>1 then raise exception '課程與活動每項限報名一位。';end if;$old$;
 if strpos(definition,needle)=0 then raise exception 'Production registration path changed; migration aborted.';end if;
 definition:=replace(definition,needle,'');
 needle:=$old$if exists(select 1 from public.orders old join public.ecpay_transactions tx on tx.order_id=old.id cross join lateral jsonb_array_elements(old.items) item where old.user_id=p_user and old.status<>'cancelled' and tx.environment='production' and tx.status in ('pending','paid','simulated') and item->>'id'=p.id) then raise exception '已有此課程／活動的待付款或已繳費訂單，請先查看會員訂單。';end if;$old$;
 if strpos(definition,needle)=0 then raise exception 'Production duplicate path changed; migration aborted.';end if;
 definition:=replace(definition,needle,'');
 needle:='items:=items||jsonb_build_array';
 definition:=replace(definition,needle,$new$if p.max_per_order is not null and q>p.max_per_order then raise exception '超過此商品每筆訂單的人數／數量上限。';end if;
 items:=items||jsonb_build_array$new$);
 execute definition;
end$$;
commit;
