import {PGlite} from './.cloud-validation/pglite/dist/index.js';
import fs from 'node:fs';import assert from 'node:assert/strict';
const db=new PGlite();
await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid,name text,bucket_id text);create function storage.foldername(name text) returns text[] language sql as $$select string_to_array(name,'/')$$;`);
for(const file of fs.readdirSync('supabase/migrations').sort())await db.exec(fs.readFileSync('supabase/migrations/'+file,'utf8'));
await db.exec(fs.readFileSync('supabase/migrations/20261126045147_ecpay_stage_checkout.sql','utf8'));
const admin='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',student='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
await db.exec(`insert into auth.users(id,email) values('${admin}','admin@example.test'),('${student}','student@example.test');update public.user_roles set role='admin' where user_id='${admin}';update public.catalog set price=100,active=true where id in ('activity-wheelie','course-l1');`);
const ids=(await db.query("select id from public.catalog where group_name in ('課程類','活動類') order by id")).rows;
const activity=(await db.query("select id from public.catalog where group_name='活動類' limit 1")).rows[0].id;
await db.query('update public.catalog set price=100,active=true where id=$1',[activity]);
await db.query('insert into public.cart values($1,$2,1)',[admin,activity]);
const reg={name:'測試學員',phone:'0912345678',bike:'CRF250L / 250cc'};
async function register(key,r=reg){return(await db.query("select public.academy_ecpay_stage_register($1,$2,'',$3::jsonb) as r",[admin,key,JSON.stringify(r)])).rows[0].r}
await assert.rejects(register('registration-test-001',{}));
assert.equal((await db.query('select count(*)::int as n from public.orders')).rows[0].n,0);
await db.query('update public.cart set qty=2 where user_id=$1',[admin]);await assert.rejects(register('registration-test-001'));await db.query('update public.cart set qty=1 where user_id=$1',[admin]);
await db.exec('set role service_role');const created=await register('registration-test-001');await db.exec('reset role');
assert.deepEqual(created.order.registration,reg);assert.equal((await register('registration-test-001',{...reg,name:'不應覆蓋'})).order.registration.name,reg.name);
await db.query("select set_config('request.jwt.claim.sub',$1,false)",[admin]);await db.exec('set role authenticated');
async function roster(kind='活動類',test=true){return(await db.query('select public.academy_paid_registrations($1,$2) as r',[kind,test])).rows[0].r.rows}
assert.equal((await roster()).length,0);
await db.exec('reset role');
async function mark(status,sim,verified,fp){await db.query('select public.academy_ecpay_stage_apply($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[created.payment.merchant_trade_no,'3002607',100,status,'stage123','','1',sim,verified,'notify',fp.repeat(64)])}
await mark('simulated',true,false,'a');assert.equal((await roster()).length,0);await mark('test_paid',false,true,'b');
assert.equal((await roster('活動類',false)).length,0);let rows=await roster();assert.equal(rows.length,1);assert.equal(rows[0].phone,reg.phone);assert.equal(rows[0].missingDetails,false);assert.equal((await roster('課程類')).length,0);
await db.query("update public.catalog set group_name='課程類' where id=$1",[activity]);assert.equal((await roster()).length,1);
await db.query("select set_config('request.jwt.claim.sub',$1,false)",[student]);await db.exec('set role authenticated');await assert.rejects(roster());await assert.rejects(register('registration-test-002'));
await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[admin]);await db.query("update public.orders set status='cancelled' where id=$1",[created.order.id]);assert.equal((await roster()).length,0);
console.log('PASS: required registration, one-person quantity, atomic failure, service-only create, immutable retry, unpaid/simulated exclusion, paid stage/formal separation, item snapshot classification, admin-only roster, cancelled exclusion.');await db.close();
