import assert from 'node:assert/strict';import fs from 'node:fs';import {stripTypeScriptTypes} from 'node:module';
import {checkoutParams,verifyMac,METHODS,paymentInfo,expirySeconds} from './supabase/functions/_shared/ecpay.mjs';
for(const method of Object.keys(METHODS)){
 const p=await checkoutParams({environment:'stage',merchant_id:'3002607',amount:100,method,merchant_trade_no:'WRtest',order_id:'order',created_at:1795680000},'https://test.supabase.co/functions/v1','https://example.test/');
 assert.equal(p.ChoosePayment,method);assert(await verifyMac(p));
 if(['ATM','CVS','BARCODE'].includes(method)){assert(p.PaymentInfoURL.endsWith('ecpay-info'));assert(p.ClientRedirectURL.endsWith('ecpay-return'));assert(!p.OrderResultURL)}else assert(p.OrderResultURL);
 if(method==='ATM')assert.equal(p.ExpireDate,'3');if(method==='CVS')assert.equal(p.StoreExpireDate,'4320');if(method==='BARCODE')assert.equal(p.StoreExpireDate,'3');
 for(const amount of [METHODS[method].min-1,METHODS[method].max+1])await assert.rejects(checkoutParams({environment:'stage',merchant_id:'3002607',amount,method},'',''));
}
const atm={RtnCode:'2',PaymentType:'ATM_TAISHIN',BankCode:'812',vAccount:'1234567890123456',ExpireDate:'2026/11/29'};
assert.equal(paymentInfo(atm,'ATM').info.account,atm.vAccount);assert.equal(expirySeconds('2026/11/29'),expirySeconds('2026/11/29 23:59:59'));
assert.throws(()=>expirySeconds('2026/02/30'));assert.throws(()=>paymentInfo({...atm,BankCode:'<svg>'},'ATM'));assert.equal(paymentInfo(atm,'CVS'),null);
const cvs={RtnCode:'10100073',PaymentType:'CVS_CVS',PaymentNo:'LLL12345678901',ExpireDate:'2026/11/29 12:00:00'};assert.equal(paymentInfo(cvs,'CVS').info.code,cvs.PaymentNo);
assert.equal(paymentInfo({...cvs,RtnCode:'0'},'CVS'),null);assert(paymentInfo({...cvs,RtnCode:'1'},'CVS',true));assert.equal(paymentInfo({...cvs,RtnCode:'1'},'CVS'),null);
const barcode={RtnCode:'10100073',PaymentType:'BARCODE_BARCODE',Barcode1:'123456789',Barcode2:'123456789012',Barcode3:'123456789012345',ExpireDate:'2026/11/29 12:00:00'};assert.equal(paymentInfo(barcode,'BARCODE').info.barcodes.length,3);assert.throws(()=>paymentInfo({...barcode,Barcode3:'<script>'},'BARCODE'));
for(const path of ['ecpay-info/index.ts','ecpay-checkout/index.ts','ecpay-notify/index.ts','_shared/ecpay-runtime.ts'])new Function(stripTypeScriptTypes(fs.readFileSync('supabase/functions/'+path,'utf8'),{mode:'strip'}).replace(/^import .*;\r?\n/gm,'').replace(/export /g,''));
console.log('PASS: 5 signed method payloads, all amount boundaries, callback routes, deadline units, method/code validation, Taiwan expiry/calendar checks, query-only success rules, Edge syntax.');
