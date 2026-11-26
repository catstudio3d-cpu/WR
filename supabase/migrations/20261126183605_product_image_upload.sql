begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('product-images','product-images',true,1200000,array['image/jpeg'])
on conflict(id) do nothing;
create policy academy_product_image_insert on storage.objects for insert to authenticated
with check(bucket_id='product-images' and name ~ '^products/[a-f0-9-]{36}\.jpg$' and (select public.is_academy_admin()));

create or replace function public.academy_valid_product_image(value text) returns boolean
language sql immutable security invoker set search_path='' as $$
select coalesce((value ~ '^assets/[a-zA-Z0-9_./-]+\.(png|jpg|jpeg|webp)$' and value not like '%..%')
or value ~ '^https://fyqlfldjoaikmxowmrfi\.supabase\.co/storage/v1/object/public/product-images/products/[a-f0-9-]{36}\.jpg$',false)
$$;
revoke all on function public.academy_valid_product_image(text) from public,anon,authenticated;

-- Preserve the latest checkout/admin logic while extending the exact image allowlist.
do $$declare fn text;definition text;old_predicate text:=$predicate$coalesce(p_data->>'image','')!~'^assets/[a-zA-Z0-9_./-]+\.(png|jpg|jpeg|webp)$' or p_data->>'image' like '%..%'$predicate$;
begin
 foreach fn in array array['public.academy_request(text,jsonb)','public.academy_request_base(text,jsonb)'] loop
  select pg_get_functiondef(fn::regprocedure) into definition;
  if strpos(definition,old_predicate)=0 then raise exception 'Expected image validation was not found; aborting without changes.';end if;
  definition:=replace(definition,old_predicate,'(not public.academy_valid_product_image(p_data->>''image''))');
  definition:=replace(definition,'請使用網站內的商品圖片路徑。','請使用既有商品圖片或從後台上傳圖片。');
  execute definition;
 end loop;
end$$;
commit;
