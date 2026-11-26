import {checkoutParams,STAGE} from './supabase/functions/_shared/ecpay.mjs';
import fs from 'node:fs';import assert from 'node:assert/strict';
const params=await checkoutParams({environment:'stage',merchant_id:STAGE.merchantId,amount:100,merchant_trade_no:'WR'+crypto.randomUUID().replaceAll('-','').slice(0,18),order_id:crypto.randomUUID(),created_at:Math.floor(Date.now()/1000)},'https://fyqlfldjoaikmxowmrfi.supabase.co/functions/v1','https://catstudio3d-cpu.github.io/WR/');
const response=await fetch(STAGE.gateway,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(params),signal:AbortSignal.timeout(25000)});
const html=await response.text();fs.writeFileSync('.cloud-validation/ecpay-stage-response.html',html);
assert.equal(response.status,200);assert(!/CheckMacValue.*(?:Error|錯誤)|檢查碼.*錯誤/i.test(html),'Gateway rejected signature');
assert(/信用卡|Credit|credit|付款/i.test(html),'No checkout page returned');
console.log(JSON.stringify({status:response.status,url:response.url,pageTitle:html.match(/<title>([^<]*)<\/title>/i)?.[1],bytes:html.length,submittedCard:false}));
