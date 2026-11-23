-- Zero-price items remain visible as previews but cannot be purchased.
-- Apply after migrations 001, 002 and 003. Existing orders are preserved.
begin;
create or replace function public.academy_zero_price_unlisted()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.price=0 then new.active:=false;end if;
 return new;
end$$;
revoke all on function public.academy_zero_price_unlisted() from public,anon,authenticated;
drop trigger if exists academy_zero_price_unlisted on public.catalog;
create trigger academy_zero_price_unlisted before insert or update of price,active
on public.catalog for each row execute function public.academy_zero_price_unlisted();
update public.catalog set active=false,revision=revision+1 where price=0 and active;
create or replace function public.academy_request(p_action text,p_data jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();v_result jsonb;v_featured boolean;v_order integer;v_product public.catalog%rowtype;
begin
 if p_action='catalog' then return jsonb_build_object('products',(select coalesce(jsonb_agg(public.academy_product(c) order by c.id),'[]') from public.catalog c where c.active or c.price=0));end if;
 if p_action in ('admin.product-create','admin.product') then
  if uid is null or not public.is_academy_admin() then raise exception '此功能僅供管理者使用。' using errcode='42501';end if;
  if p_data ? 'featured' and jsonb_typeof(p_data->'featured') is distinct from 'boolean' then raise exception '首頁廣告設定不正確。';end if;
  if p_data ? 'ad_order' and (coalesce(p_data->>'ad_order','')!~'^\d{1,4}$' or (p_data->>'ad_order')::integer not between 0 and 9999) then raise exception '廣告排序需為 0–9999。';end if;
  if p_action='admin.product' then
   v_result:=public.academy_request_base(p_action,p_data);
   update public.catalog set featured=case when p_data ? 'featured' then (p_data->>'featured')::boolean else featured end,ad_order=case when p_data ? 'ad_order' then (p_data->>'ad_order')::integer else ad_order end where id=p_data->>'id';
   return v_result;
  end if;
  if coalesce(p_data->>'id','')!~'^[a-z0-9][a-z0-9-]{0,59}$' or char_length(trim(coalesce(p_data->>'name',''))) not between 1 and 100 or char_length(trim(coalesce(p_data->>'group',''))) not between 1 and 60 or char_length(trim(coalesce(p_data->>'category',''))) not between 1 and 60 or char_length(coalesce(p_data->>'description',''))>1200 then raise exception '請填寫正確的商品代碼、名稱與分類。';end if;
  if coalesce(p_data->>'image','')!~'^assets/[a-zA-Z0-9_./-]+\.(png|jpg|jpeg|webp)$' or p_data->>'image' like '%..%' then raise exception '請使用網站內的商品圖片路徑。';end if;
  if jsonb_typeof(p_data->'demo') is distinct from 'boolean' or jsonb_typeof(p_data->'active') is distinct from 'boolean' or coalesce(p_data->>'price','')!~'^\d{1,8}$' then raise exception '價格或商品狀態不正確。';end if;
  if p_data->>'stock' is not null and coalesce(p_data->>'stock','')!~'^\d{1,7}$' then raise exception '庫存需為非負整數。';end if;
  if not(p_data->>'demo')::boolean and p_data->>'stock' is null then raise exception '正式商品需填寫庫存。';end if;
  insert into public.catalog(id,name,group_name,category,price,image,description,is_demo,stock,active,featured,ad_order) values(p_data->>'id',trim(p_data->>'name'),trim(p_data->>'group'),trim(p_data->>'category'),(p_data->>'price')::integer,p_data->>'image',coalesce(p_data->>'description',''),(p_data->>'demo')::boolean,(p_data->>'stock')::integer,(p_data->>'active')::boolean,coalesce((p_data->>'featured')::boolean,false),coalesce((p_data->>'ad_order')::integer,100));
  insert into public.audit(actor,action,object_id) values(uid,'product.create',p_data->>'id');return jsonb_build_object('ok',true,'id',p_data->>'id');
 end if;
 return public.academy_request_base(p_action,p_data);
end$$;
revoke all on function public.academy_request(text,jsonb) from public;
grant execute on function public.academy_request(text,jsonb) to anon,authenticated;

commit;
