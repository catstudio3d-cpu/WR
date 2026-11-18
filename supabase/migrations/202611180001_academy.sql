-- Run in Supabase SQL Editor. This creates cloud tables; it does not import local SQLite users.
begin;
create table if not exists public.profiles(id uuid primary key references auth.users on delete cascade,email text not null,name text not null check(char_length(name) between 1 and 40),bike text not null default '' check(char_length(bike)<=100),experience text not null default '' check(char_length(experience)<=300),goal text not null default '' check(char_length(goal)<=500),avatar_path text,created_at bigint not null default extract(epoch from now())::bigint,check(avatar_path is null or avatar_path=id::text||'/avatar.jpg'));
create table if not exists public.user_roles(user_id uuid primary key references auth.users on delete cascade,role text not null default 'student' check(role in ('student','admin')));
create or replace function public.is_academy_admin() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.user_roles where user_id=auth.uid() and role='admin')$$;
revoke all on function public.is_academy_admin() from public;grant execute on function public.is_academy_admin() to authenticated;
create or replace function public.academy_new_user() returns trigger language plpgsql security definer set search_path='' as $$begin insert into public.profiles(id,email,name) values(new.id,coalesce(new.email,''),left(coalesce(nullif(trim(new.raw_user_meta_data->>'name'),''),nullif(trim(new.raw_user_meta_data->>'full_name'),''),'馭野學員'),40)) on conflict(id) do nothing;insert into public.user_roles(user_id) values(new.id) on conflict do nothing;return new;end$$;
revoke all on function public.academy_new_user() from public;
drop trigger if exists academy_user_created on auth.users;create trigger academy_user_created after insert on auth.users for each row execute function public.academy_new_user();
insert into public.profiles(id,email,name) select id,coalesce(email,''),left(coalesce(nullif(trim(raw_user_meta_data->>'name'),''),nullif(trim(raw_user_meta_data->>'full_name'),''),'馭野學員'),40) from auth.users on conflict do nothing;
insert into public.user_roles(user_id) select id from auth.users on conflict do nothing;
create table if not exists public.progress(user_id uuid primary key references auth.users on delete cascade,journal jsonb not null default '{}',revision integer not null default 0,updated_at bigint not null default extract(epoch from now())::bigint);
create table if not exists public.catalog(id text primary key,name text not null,group_name text not null,category text not null,price integer not null default 0 check(price between 0 and 10000000),image text not null,description text not null default '',is_demo boolean not null default true,stock integer check(stock between 0 and 1000000),active boolean not null default true,revision integer not null default 0);
create table if not exists public.cart(user_id uuid not null references auth.users on delete cascade,product_id text not null references public.catalog,qty integer not null check(qty between 1 and 20),primary key(user_id,product_id));
create table if not exists public.orders(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users,request_key text not null,items jsonb not null,total bigint not null,kind text not null check(kind in ('inquiry','reservation')),status text not null default 'pending' check(status in ('pending','processing','completed','cancelled')),note text not null default '',created_at bigint not null default extract(epoch from now())::bigint,unique(user_id,request_key));
create table if not exists public.assessments(id bigint generated always as identity primary key,user_id uuid not null references auth.users,target text not null check(target in ('L1','L2','L3','wheelie','sand','slide','jump')),outcome text not null check(outcome in ('passed','needs_practice')),instructor text not null,test_date date not null,hours text not null default '',comment text not null default '',created_by uuid not null references auth.users,created_at bigint not null default extract(epoch from now())::bigint);
create table if not exists public.certificates(id uuid primary key default gen_random_uuid(),assessment_id bigint unique not null references public.assessments,serial text unique not null,user_id uuid not null references auth.users,target text not null,student_name text not null,instructor text not null,test_date date not null,hours text not null default '',issued_at bigint not null default extract(epoch from now())::bigint,revoked_at bigint,revoked_reason text);
create table if not exists public.audit(id bigint generated always as identity primary key,actor uuid not null,action text not null,object_id text not null,detail text not null default '',created_at bigint not null default extract(epoch from now())::bigint);
alter table public.profiles enable row level security;alter table public.user_roles enable row level security;alter table public.progress enable row level security;alter table public.catalog enable row level security;alter table public.cart enable row level security;alter table public.orders enable row level security;alter table public.assessments enable row level security;alter table public.certificates enable row level security;alter table public.audit enable row level security;
revoke all on public.profiles,public.user_roles,public.progress,public.catalog,public.cart,public.orders,public.assessments,public.certificates,public.audit from anon,authenticated;
grant select on public.profiles,public.user_roles,public.progress,public.catalog,public.cart,public.orders,public.assessments,public.certificates,public.audit to authenticated;
grant update(name,bike,experience,goal,avatar_path) on public.profiles to authenticated;
drop policy if exists profile_read on public.profiles;create policy profile_read on public.profiles for select to authenticated using(id=auth.uid() or public.is_academy_admin());
drop policy if exists profile_update on public.profiles;create policy profile_update on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
drop policy if exists role_read on public.user_roles;create policy role_read on public.user_roles for select to authenticated using(user_id=auth.uid());
drop policy if exists progress_read on public.progress;create policy progress_read on public.progress for select to authenticated using(user_id=auth.uid());
drop policy if exists catalog_read on public.catalog;create policy catalog_read on public.catalog for select to authenticated using(active or public.is_academy_admin());
drop policy if exists cart_read on public.cart;create policy cart_read on public.cart for select to authenticated using(user_id=auth.uid());
drop policy if exists orders_read on public.orders;create policy orders_read on public.orders for select to authenticated using(user_id=auth.uid() or public.is_academy_admin());
drop policy if exists assessment_read on public.assessments;create policy assessment_read on public.assessments for select to authenticated using(user_id=auth.uid() or public.is_academy_admin());
drop policy if exists certificate_read on public.certificates;create policy certificate_read on public.certificates for select to authenticated using(user_id=auth.uid() or public.is_academy_admin());
drop policy if exists audit_read on public.audit;create policy audit_read on public.audit for select to authenticated using(public.is_academy_admin());
create or replace function public.academy_product(p public.catalog) returns jsonb language sql immutable set search_path='' as $$select jsonb_build_object('id',p.id,'name',p.name,'group',p.group_name,'category',p.category,'price',p.price,'image',p.image,'description',p.description,'demo',p.is_demo,'stock',p.stock,'active',p.active,'revision',p.revision)$$;
revoke all on function public.academy_product(public.catalog) from public;
create or replace function public.academy_request(p_action text,p_data jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();v_item jsonb;v_items jsonb;v_row public.catalog%rowtype;v_order public.orders%rowtype;v_assessment public.assessments%rowtype;v_cert public.certificates%rowtype;v_id uuid;v_qty integer;v_total bigint:=0;v_demo boolean:=false;v_revision integer;v_target text;v_outcome text;v_status text;v_key text;v_name text;v_aid bigint;v_count integer;v_now bigint:=extract(epoch from now())::bigint;
begin
 if p_action='catalog' then return jsonb_build_object('products',(select coalesce(jsonb_agg(public.academy_product(c) order by c.id),'[]') from public.catalog c where active));end if;
 if uid is null then raise exception '請先登入會員。' using errcode='42501';end if;
 if p_action like 'admin.%' and not public.is_academy_admin() then raise exception '此功能僅供管理者使用。' using errcode='42501';end if;
 if p_action='progress' then return coalesce((select jsonb_build_object('journal',journal,'revision',revision) from public.progress where user_id=uid),jsonb_build_object('journal','{}'::jsonb,'revision',0));end if;
 if p_action='progress.save' then
  if jsonb_typeof(p_data->'journal') is distinct from 'object' or octet_length((p_data->'journal')::text)>100000 or jsonb_typeof(p_data->'revision') is distinct from 'number' then raise exception '練習紀錄格式不正確。';end if;
  for v_key,v_item in select * from jsonb_each(p_data->'journal') loop
   if not(v_key=any(array['setup','posture','controls','balance','turns','brake','terrain','hills','rescue','etiquette','tight','rearbrake','restart','frontlift','logs','traction','recovery','pivot','hop','blip','zap','splatter','lineplan','wheelie','sand','slide','jump','fieldrepair'])) or jsonb_typeof(v_item) is distinct from 'object' then raise exception '技能資料不正確。';end if;
   if coalesce(v_item->>'status','') not in ('new','learning','practiced') or jsonb_typeof(v_item->'notes') is distinct from 'string' or char_length(v_item->>'notes')>1200 or jsonb_typeof(v_item->'updatedAt') is distinct from 'string' or char_length(v_item->>'updatedAt')>50 or (v_item-array['status','notes','updatedAt'])<>'{}'::jsonb then raise exception '自記進度不可設定教練認證。';end if;
  end loop;
  insert into public.progress(user_id) values(uid) on conflict do nothing;
  update public.progress set journal=p_data->'journal',revision=revision+1,updated_at=v_now where user_id=uid and revision=(p_data->>'revision')::integer returning revision into v_revision;
  if not found then raise exception '紀錄已在其他頁面更新，請重新整理後再試。';end if;
  return jsonb_build_object('journal',p_data->'journal','revision',v_revision);
 end if;
 if p_action in ('cart.set','cart.merge') then
  perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
  v_items:=case when p_action='cart.merge' then p_data->'items' else jsonb_build_array(p_data) end;
  if jsonb_typeof(v_items) is distinct from 'array' or jsonb_array_length(v_items)>100 then raise exception '購物車資料不正確。';end if;
  for v_item in select * from jsonb_array_elements(v_items) loop
   if jsonb_typeof(v_item->'quantity') is distinct from 'number' or coalesce(v_item->>'quantity','')!~'^\d{1,2}$' then raise exception '商品數量不正確。';end if;v_qty:=(v_item->>'quantity')::integer;
   select * into v_row from public.catalog where id=v_item->>'id';if not found or v_qty not between 0 and 20 or (not v_row.active and v_qty>0) then raise exception '商品已下架或數量不正確。';end if;
   if p_action='cart.merge' then select least(20,v_qty+coalesce((select qty from public.cart where user_id=uid and product_id=v_row.id),0)) into v_qty;end if;
   if v_qty=0 then delete from public.cart where user_id=uid and product_id=v_row.id;else insert into public.cart values(uid,v_row.id,v_qty) on conflict(user_id,product_id) do update set qty=excluded.qty;end if;
  end loop;
 end if;
 if p_action in ('cart','cart.set','cart.merge') then return jsonb_build_object('items',(select coalesce(jsonb_agg(public.academy_product(c)||jsonb_build_object('quantity',x.qty) order by c.id),'[]') from public.cart x join public.catalog c on c.id=x.product_id where x.user_id=uid));end if;
 if p_action='orders' then return jsonb_build_object('orders',(select coalesce(jsonb_agg(to_jsonb(o) order by o.created_at desc),'[]') from public.orders o where user_id=uid));end if;
 if p_action='assessments' then return jsonb_build_object('assessments',(select coalesce(jsonb_agg(to_jsonb(a) order by id desc),'[]') from public.assessments a where user_id=uid),'certificates',(select coalesce(jsonb_agg(to_jsonb(c) order by issued_at desc),'[]') from public.certificates c where user_id=uid));end if;
 if p_action='checkout' then
  if coalesce(p_data->>'requestKey','')!~'^[a-zA-Z0-9-]{16,80}$' or char_length(coalesce(p_data->>'note',''))>500 then raise exception '訂單資料不正確。';end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
  select * into v_order from public.orders where user_id=uid and request_key=p_data->>'requestKey';if found then return jsonb_build_object('order',to_jsonb(v_order));end if;
  v_items:='[]'::jsonb;
  for v_row in select c.* from public.catalog c join public.cart x on x.product_id=c.id where x.user_id=uid order by c.id for update of c loop
   select qty into v_qty from public.cart where user_id=uid and product_id=v_row.id;
   if not v_row.active or (not v_row.is_demo and (v_row.stock is null or v_row.stock<v_qty)) then raise exception '商品已下架或庫存不足，請重新確認。';end if;
   v_items:=v_items||jsonb_build_array(public.academy_product(v_row)||jsonb_build_object('quantity',v_qty));v_total:=v_total+v_row.price::bigint*v_qty;v_demo:=v_demo or v_row.is_demo or v_row.price=0;
   if not v_row.is_demo then update public.catalog set stock=stock-v_qty,revision=revision+1 where id=v_row.id;end if;
  end loop;
  if jsonb_array_length(v_items)=0 then raise exception '購物車沒有商品。';end if;
  insert into public.orders(user_id,request_key,items,total,kind,note) values(uid,p_data->>'requestKey',v_items,v_total,case when v_demo then 'inquiry' else 'reservation' end,coalesce(p_data->>'note','')) returning * into v_order;
  delete from public.cart where user_id=uid;insert into public.audit(actor,action,object_id,detail) values(uid,'order.create',v_order.id::text,v_order.kind);return jsonb_build_object('order',to_jsonb(v_order));
 end if;
 if p_action='admin.overview' then return jsonb_build_object(
 'products',(select coalesce(jsonb_agg(public.academy_product(c) order by id),'[]') from public.catalog c),
 'members',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'email',p.email,'role',coalesce(r.role,'student')) order by p.created_at desc),'[]') from public.profiles p left join public.user_roles r on r.user_id=p.id),
 'orders',(select coalesce(jsonb_agg(to_jsonb(o)||jsonb_build_object('member_name',p.name) order by o.created_at desc),'[]') from public.orders o join public.profiles p on p.id=o.user_id),
 'assessments',(select coalesce(jsonb_agg(to_jsonb(a)||jsonb_build_object('member_name',p.name) order by a.id desc),'[]') from public.assessments a join public.profiles p on p.id=a.user_id),
 'certificates',(select coalesce(jsonb_agg(to_jsonb(c) order by issued_at desc),'[]') from public.certificates c),
 'targets',jsonb_build_object('L1','基礎控車・基礎林道','L2','技術林道・硬耐力入門','L3','硬耐力進階','wheelie','孤輪專項','sand','砂地專項','slide','滑胎專項','jump','跳躍專項'),
 'audit',(select coalesce(jsonb_agg(to_jsonb(a) order by id desc),'[]') from(select id,action,object_id,detail,created_at from public.audit order by id desc limit 50)a));end if;
 if p_action='admin.product' then
  if coalesce(p_data->>'name','')='' or char_length(p_data->>'name')>100 or coalesce(p_data->>'group','')='' or char_length(p_data->>'group')>60 or coalesce(p_data->>'category','')='' or char_length(p_data->>'category')>60 or char_length(coalesce(p_data->>'description',''))>1200 or coalesce(p_data->>'image','')!~'^assets/[a-zA-Z0-9_./-]+\.(png|jpg|jpeg|webp)$' or p_data->>'image' like '%..%' then raise exception '商品名稱、分類或圖片路徑不正確。';end if;
  if jsonb_typeof(p_data->'demo') is distinct from 'boolean' or jsonb_typeof(p_data->'active') is distinct from 'boolean' or coalesce(p_data->>'price','')!~'^\d+$' or coalesce(p_data->>'revision','')!~'^\d+$' then raise exception '商品價格或狀態不正確。';end if;
  if not(p_data->>'demo')::boolean and p_data->>'stock' is null then raise exception '正式商品需填寫庫存。';end if;
  update public.catalog set name=p_data->>'name',group_name=p_data->>'group',category=p_data->>'category',price=(p_data->>'price')::integer,image=p_data->>'image',description=coalesce(p_data->>'description',''),stock=(p_data->>'stock')::integer,is_demo=(p_data->>'demo')::boolean,active=(p_data->>'active')::boolean,revision=revision+1 where id=p_data->>'id' and revision=(p_data->>'revision')::integer;
  if not found then raise exception '商品已更新，請重新整理。';end if;
 elsif p_action='admin.order' then
  v_status:=p_data->>'status';if v_status not in ('pending','processing','completed','cancelled') or v_status is null then raise exception '訂單狀態不正確。';end if;
  select * into v_order from public.orders where id=(p_data->>'id')::uuid for update;if not found then raise exception '找不到訂單。';end if;
  if v_order.status in ('completed','cancelled') and v_status<>v_order.status then raise exception '已結束訂單不可重新開啟。';end if;
  if v_status='cancelled' and v_order.status<>'cancelled' then for v_item in select * from jsonb_array_elements(v_order.items) loop if not(v_item->>'demo')::boolean then update public.catalog set stock=stock+(v_item->>'quantity')::integer,revision=revision+1 where id=v_item->>'id';end if;end loop;end if;
  update public.orders set status=v_status where id=v_order.id;
 elsif p_action='admin.assessment' then
  if coalesce(p_data->>'target','') not in ('L1','L2','L3','wheelie','sand','slide','jump') or coalesce(p_data->>'outcome','') not in ('passed','needs_practice') or char_length(trim(coalesce(p_data->>'instructor',''))) not between 1 and 60 or coalesce(p_data->>'date','')!~'^\d{4}-\d{2}-\d{2}$' or (p_data->>'date')::date>(now() at time zone 'Asia/Taipei')::date or coalesce(p_data->>'hours','')!~'^(\d{1,3}(\.\d)?)?$' or char_length(coalesce(p_data->>'comment',''))>1200 then raise exception '評量資料不正確。';end if;
  insert into public.assessments(user_id,target,outcome,instructor,test_date,hours,comment,created_by) values((p_data->>'userId')::uuid,p_data->>'target',p_data->>'outcome',trim(p_data->>'instructor'),(p_data->>'date')::date,coalesce(p_data->>'hours',''),coalesce(p_data->>'comment',''),uid) returning id into v_aid;
  insert into public.audit(actor,action,object_id,detail) values(uid,'assessment.record',v_aid::text,p_data->>'outcome');return jsonb_build_object('id',v_aid);
 elsif p_action='admin.issue' then
  select * into v_assessment from public.assessments where id=(p_data->>'assessmentId')::bigint for update;if not found or v_assessment.outcome<>'passed' then raise exception '僅可依通過評量核發證書。';end if;
  select * into v_cert from public.certificates where assessment_id=v_assessment.id;if found then return jsonb_build_object('certificate',to_jsonb(v_cert));end if;
  select name into v_name from public.profiles where id=v_assessment.user_id;
  insert into public.certificates(assessment_id,serial,user_id,target,student_name,instructor,test_date,hours) values(v_assessment.id,'WRA-'||upper(v_assessment.target)||'-'||extract(year from now())::text||'-'||lpad(v_assessment.id::text,6,'0'),v_assessment.user_id,v_assessment.target,v_name,v_assessment.instructor,v_assessment.test_date,v_assessment.hours) returning * into v_cert;
  insert into public.audit(actor,action,object_id,detail) values(uid,'certificate.issue',v_cert.id::text,v_cert.serial);return jsonb_build_object('certificate',to_jsonb(v_cert));
 elsif p_action='admin.revoke' then
  if char_length(trim(coalesce(p_data->>'reason',''))) not between 1 and 500 then raise exception '請填寫撤銷原因。';end if;
  update public.certificates set revoked_at=v_now,revoked_reason=trim(p_data->>'reason') where id=(p_data->>'id')::uuid and revoked_at is null;
  if not found then raise exception '找不到有效證書。';end if;
 else raise exception '找不到此功能。';
 end if;
 insert into public.audit(actor,action,object_id,detail) values(uid,p_action,coalesce(p_data->>'id',''),case when p_action='admin.revoke' then p_data->>'reason' else coalesce(p_data->>'status','') end);return jsonb_build_object('ok',true);
end$$;
revoke all on function public.academy_request(text,jsonb) from public;grant execute on function public.academy_request(text,jsonb) to anon,authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('avatars','avatars',false,600000,array['image/jpeg']) on conflict(id) do nothing;
drop policy if exists academy_avatar_read on storage.objects;create policy academy_avatar_read on storage.objects for select to authenticated using(bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists academy_avatar_insert on storage.objects;create policy academy_avatar_insert on storage.objects for insert to authenticated with check(bucket_id='avatars' and name=auth.uid()::text||'/avatar.jpg');
drop policy if exists academy_avatar_update on storage.objects;create policy academy_avatar_update on storage.objects for update to authenticated using(bucket_id='avatars' and name=auth.uid()::text||'/avatar.jpg') with check(bucket_id='avatars' and name=auth.uid()::text||'/avatar.jpg');
drop policy if exists academy_avatar_delete on storage.objects;create policy academy_avatar_delete on storage.objects for delete to authenticated using(bucket_id='avatars' and name=auth.uid()::text||'/avatar.jpg');
commit;
