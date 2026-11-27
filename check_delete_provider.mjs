import fs from 'node:fs';import assert from 'node:assert/strict';import {stripTypeScriptTypes}from 'node:module';import *as core from './supabase/functions/_shared/ecpay.mjs';
const key='0123456789abcdef',iv='fedcba9876543210',env={SUPABASE_URL:'https://example.test',SUPABASE_SERVICE_ROLE_KEY:'fake',ECPAY_MERCHANT_ID:'3096502',ECPAY_HASH_KEY:key,ECPAY_HASH_IV:iv};let applied=[],response;
const service={rpc(name,args){applied.push({name,args});return Promise.resolve({data:{status:args.p_status},error:null})}};
const code=stripTypeScriptTypes(fs.readFileSync('supabase/functions/_shared/ecpay-runtime.ts','utf8'),{mode:'strip'}).replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'');
const runtime=new Function('createClient','STAGE','checkMac','verifyMac','parseForm','fingerprint','paymentInfo','Deno','fetch',code+'\nreturn{verifyUnpaid};')(()=>service,core.STAGE,core.checkMac,core.verifyMac,core.parseForm,core.fingerprint,core.paymentInfo,{env:{get:k=>env[k]}},async()=>({ok:response.ok!==false,text:async()=>response.raw}));
const t={environment:'production',merchant_id:'3096502',merchant_trade_no:'WPdeletecheck',amount:90,status:'pending'};
async function answer(status,change={}){const p={MerchantID:'3096502',MerchantTradeNo:t.merchant_trade_no,TradeAmt:'90',TradeNo:'prod001',PaymentDate:'2026/11/27 12:00:00',TradeStatus:status,SimulatePaid:'0',...change};p.CheckMacValue=await core.checkMac(p,key,iv);response={raw:new URLSearchParams(p).toString()};applied=[]}
await answer('0');assert.equal((await runtime.verifyUnpaid(t)).verification,'unpaid');assert.equal(applied[0].args.p_status,'pending');
await answer('10200095');assert.equal((await runtime.verifyUnpaid(t)).verification,'not_created');
await answer('1');await assert.rejects(runtime.verifyUnpaid(t),/付款成功/);assert.equal(applied[0].args.p_status,'paid');assert.equal(applied[0].args.p_verified,true);
await answer('0',{TradeAmt:'1'});await assert.rejects(runtime.verifyUnpaid(t));assert.equal(applied.length,0);
await answer('0',{MerchantID:'3002607'});await assert.rejects(runtime.verifyUnpaid(t));
response={raw:'TradeStatus=0&CheckMacValue=forged'};await assert.rejects(runtime.verifyUnpaid(t));
await answer('unrecognized');await assert.rejects(runtime.verifyUnpaid(t));assert.equal(applied.length,0);
await answer('1',{SimulatePaid:'1'});await assert.rejects(runtime.verifyUnpaid(t));assert.equal(applied.length,0);
console.log('PASS: fresh signed provider check, amount/merchant/signature/unknown/simulated rejection, actual paid persisted and deletion blocked; no real provider transaction.');
