import {signature,lookup,matches,saveInfo} from '../_shared/ecpay-runtime.ts';
import {parseForm,verifyMac} from '../_shared/ecpay.mjs';
// 僅保存取號資料；不更新付款成功狀態，不核發報名或證書。
Deno.serve(async request=>{
 const reply=(text:string,status=200)=>new Response(text,{status,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});
 if(request.method!=='POST')return reply('0|Method not allowed',405);
 if(!request.headers.get('Content-Type')?.includes('application/x-www-form-urlencoded'))return reply('0|Invalid content type',400);
 try{
  if(Number(request.headers.get('content-length')||0)>32768)return reply('0|Payload too large',413);
  const params=parseForm(await request.text());
  const transaction=await lookup(params.MerchantTradeNo||'');if(!transaction||!await signature(transaction,params)||!matches(transaction,params))return reply('0|Invalid transaction',400);
  await saveInfo(transaction,params);return reply('1|OK');
 }catch{return reply('0|Retry later',500)}
});
