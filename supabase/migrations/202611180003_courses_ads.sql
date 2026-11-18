-- Existing cloud sites: run this migration after 001 and 002. No account data is removed.
begin;
alter table public.catalog add column if not exists featured boolean not null default false;
alter table public.catalog add column if not exists ad_order integer not null default 100 check(ad_order between 0 and 9999);
create or replace function public.academy_product(p public.catalog) returns jsonb language sql immutable set search_path='' as $$select jsonb_build_object('id',p.id,'name',p.name,'group',p.group_name,'category',p.category,'price',p.price,'image',p.image,'description',p.description,'demo',p.is_demo,'stock',p.stock,'active',p.active,'revision',p.revision,'featured',p.featured,'ad_order',p.ad_order)$$;
do $$begin if to_regprocedure('public.academy_request_base(text,jsonb)') is null then alter function public.academy_request(text,jsonb) rename to academy_request_base;end if;end$$;
revoke all on function public.academy_request_base(text,jsonb) from public,anon,authenticated;
create or replace function public.academy_request(p_action text,p_data jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();v_result jsonb;v_featured boolean;v_order integer;v_product public.catalog%rowtype;
begin
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
-- Course/activity display catalog. Existing edits and ad settings are preserved on reruns.
insert into public.catalog(id,name,group_name,category,price,image,description,featured,ad_order) values('course-l1','L1｜基礎控車・基礎林道','課程類','L1 基礎課程',0,'assets/products/course-l1.png','練習坐姿與站姿、起步停止、低速平衡、八字轉彎、緩坡與基礎林道，加入自救與求援觀念。學員自備 400cc 以下輕型越野車與完整護具。日期、場地、時數及正式費用另行公告。',false,100) on conflict(id) do nothing;
insert into public.catalog(id,name,group_name,category,price,image,description,featured,ad_order) values('course-l2','L2｜技術林道・硬耐力入門','課程類','L2 技術課程',0,'assets/products/course-l2.png','銜接 L1 對應能力，練習窄彎、後煞車協調、坡中再起步、低障礙與原木通過、坡地脫困。實際先修能力與練習範圍由教練評估。日期、場地及正式費用另行公告。',false,100) on conflict(id) do nothing;
insert into public.catalog(id,name,group_name,category,price,image,description,featured,ad_order) values('course-l3','L3｜硬耐力進階','課程類','L3 進階課程',0,'assets/products/course-l3.png','進階專項包含 Pivot Turn、Rear Wheel Hop、Double Blip、Zap、Splatter 與連續路段判讀。需具備 L2 對應能力，依專項師資與場地安排。日期及正式費用另行公告。',false,100) on conflict(id) do nothing;
insert into public.catalog(id,name,group_name,category,price,image,description,featured,ad_order) values('course-sp','SP｜獨立專項課程','課程類','SP 獨立專項',0,'assets/products/course-sp.png','依需求選擇孤輪入門、砂地騎乘、滑胎控制或跳躍入門。各專項有獨立先修條件，經教練確認能力後安排。專項內容、場地、日期及正式費用另行公告。',false,100) on conflict(id) do nothing;
insert into public.catalog(id,name,group_name,category,price,image,description,featured,ad_order) values('activity-wheelie','孤輪體驗日','活動類','孤輪活動',0,'assets/products/activity-wheelie.png','以孤輪體驗日 DM 為活動主視覺，規劃平衡感受、後煞車協調與分段練習。學員自備 400cc 以下車輛與完整護具，依教練評估安排。日期、地點及正式費用即將公布。NT$0 為展示價，非免費活動。',true,1) on conflict(id) do nothing;
commit;
