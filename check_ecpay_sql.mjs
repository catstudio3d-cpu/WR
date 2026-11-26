import {PGlite} from './.cloud-validation/pglite/dist/index.js';
import fs from 'node:fs';import assert from 'node:assert/strict';
const db=new PGlite();
await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid,name text,bucket_id text);create function storage.foldername(name text) returns text[] language sql as $$select string_to_array(name,'/')$$;`);
for(const file of fs.readdirSync('supabase/migrations').sort())await db.exec(fs.readFileSync('supabase/migrations/'+file,'utf8'));
await db.exec(fs.readFileSync('supabase/migrations/20261126045147_ecpay_stage_checkout.sql','utf8'));
const student='11111111-1111-4111-8111-111111111111',admin='22222222-2222-4222-8222-222222222222';
await db.exec(`insert into auth.users(id,email) values('${student}','student@example.test'),('${admin}','admin@example.test');update public.user_roles set role='admin' where user_id='${admin}';update public.catalog set price=300,active=true,stock=5 where id=(select id from public.catalog order by id limit 1);`);
const product=(await db.query('select id from public.catalog where price=300')).rows[0].id;
async function create(user,key='payment-test-key-001'){return(await db.query("select public.academy_ecpay_stage_create($1,$2,'test') as r",[user,key])).rows[0].r}
await assert.rejects(create(student));await assert.rejects(create(admin));
await db.query('insert into public.cart values($1,$2,2)',[admin,product]);
await db.exec('set role service_role');assert.equal((await db.query('select role from public.user_roles where user_id=$1',[admin])).rows[0].role,'admin');
const created=await create(admin);assert.equal(created.order.total,600);assert.equal(created.payment.environment,'stage');assert.equal(created.payment.merchant_trade_no.length,20);assert.equal((await create(admin)).order.id,created.order.id);
await db.exec('reset role');
assert.equal((await db.query('select stock from public.catalog where id=$1',[product])).rows[0].stock,5);
assert.equal((await db.query('select count(*)::int as n from public.cart where user_id=$1',[admin])).rows[0].n,0);
let event=0;
async function apply(status,{amount=600,verified=false,simulated=false,fingerprint}={}){return(await db.query('select public.academy_ecpay_stage_apply($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) as r',[created.payment.merchant_trade_no,'3002607',amount,status,'stage123','2026/11/26 12:00:00','1',simulated,verified,'notify',fingerprint||String(++event).padStart(64,'0')])).rows[0].r}
await assert.rejects(apply('test_paid',{amount:1,verified:true}));await assert.rejects(apply('test_paid'));await assert.rejects(apply('test_paid',{verified:true,simulated:true}));
assert.equal((await apply('simulated',{simulated:true})).status,'simulated');assert.equal((await apply('test_paid',{verified:true})).status,'test_paid');
assert.equal((await apply('failed')).status,'test_paid');
const fp='a'.repeat(64);await apply('pending',{fingerprint:fp});await apply('pending',{fingerprint:fp});assert.equal((await db.query('select count(*)::int as n from public.ecpay_events where fingerprint=$1',[fp])).rows[0].n,1);
await db.query("select set_config('request.jwt.claim.sub',$1,false)",[student]);await db.exec('set role authenticated');
assert.equal((await db.query('select * from public.ecpay_transactions')).rows.length,0);assert.equal((await db.query('select * from public.ecpay_events')).rows.length,0);
await assert.rejects(create(admin));await assert.rejects(apply('pending'));
await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[admin]);await db.exec('set role authenticated');assert.equal((await db.query('select * from public.ecpay_transactions')).rows.length,1);
await db.exec('reset role');const p=(await db.query('select payment_status,status from public.orders where id=$1',[created.order.id])).rows[0];assert.equal(p.payment_status,'test_paid');assert.equal(p.status,'pending');
console.log('PASS: migration rerun, admin-only stage, empty cart, authoritative totals, idempotent create, no stock deduction, amount/verification rejection, simulated separation, terminal success, event deduplication, member isolation, private payment writes.');await db.close();
