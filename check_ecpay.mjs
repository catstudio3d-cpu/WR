import assert from 'node:assert/strict';
import fs from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {checkMac,verifyMac,parseForm,checkoutParams,tradeDate,ecpayEncode} from './supabase/functions/_shared/ecpay.mjs';
for(const path of ['_shared/ecpay-runtime.ts','ecpay-checkout/index.ts','ecpay-notify/index.ts','ecpay-return/index.ts']){
 const source=fs.readFileSync('supabase/functions/'+path,'utf8');
 new Function(stripTypeScriptTypes(source,{mode:'strip'}).replace(/^import .*;\r?\n/gm,'').replace(/export /g,''));
}
const vectors=JSON.parse(fs.readFileSync('.cloud-validation/ecpay-vectors.json','utf8')).vectors;
let count=0;for(const v of vectors.filter(v=>v.method==='SHA256'&&v.params)){assert.equal(await checkMac(v.params,v.hashKey,v.hashIV),v.expected,v.name);count++}
assert.equal(ecpayEncode("a b~'!*()"),'a+b%7e%27!*()');
const fields={MerchantID:'3002607',TradeAmt:'100',MerchantTradeNo:'WRtest'};
fields.CheckMacValue=await checkMac(fields);assert(await verifyMac(fields));assert(!await verifyMac({...fields,TradeAmt:'1'}));
assert.throws(()=>parseForm('TradeAmt=1&tradeamt=2'));
assert.throws(()=>parseForm('x='.padEnd(32769,'x')));
assert.equal(tradeDate(0),'1970/01/01 08:00:00');
const payment={environment:'stage',merchant_id:'3002607',amount:100,merchant_trade_no:'WRtest',order_id:'test-order',created_at:0};
const params=await checkoutParams(payment,'https://test.supabase.co/functions/v1','https://example.test/');assert(await verifyMac(params));assert.equal(params.ChoosePayment,'Credit');assert(!('HashKey' in params));
await assert.rejects(checkoutParams({...payment,amount:0},'',''));await assert.rejects(checkoutParams({...payment,environment:'production'},'',''));
console.log('PASS: '+count+' official signature vectors, tampering/duplicate rejection, Taipei time, staging amount/environment constraints, Edge syntax.');
