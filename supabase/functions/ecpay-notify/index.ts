import {lookup,apply,matches,reconcile,saveInfo} from '../_shared/ecpay-runtime.ts';
import {parseForm,verifyMac} from '../_shared/ecpay.mjs';
// 公開付款通知入口：以 CheckMacValue、商店／訂單／金額與綠界主動查詢驗證。
Deno.serve(async request=>{
 const reply=(text:string,status=200)=>new Response(text,{status,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});
 if(request.method!=='POST')return reply('0|Method not allowed',405);
 if(!request.headers.get('Content-Type')?.includes('application/x-www-form-urlencoded'))return reply('0|Invalid content type',400);
 try{
  if(Number(request.headers.get('content-length')||0)>32768)return reply('0|Payload too large',413);
  const params=parseForm(await request.text());
  if(!await verifyMac(params))return reply('0|Invalid signature',400);
  const transaction=await lookup(params.MerchantTradeNo||'');
  if(!matches(transaction,params))return reply('0|Invalid transaction',400);
  if(transaction.status==='test_paid')return reply('1|OK');
  if(params.RtnCode==='2'||params.RtnCode==='10100073'){await saveInfo(transaction,params);return reply('1|OK')}
  if(params.SimulatePaid==='1'){await apply(transaction,params,'notify','simulated');return reply('1|OK')}
  const status=params.RtnCode==='1'||params.RtnCode==='10300066'?'pending':'failed';
  await apply(transaction,params,'notify',status);
  if(params.RtnCode==='1'){
   // 簽章正確但銀行結果尚待確認時，保留 pending，讓會員手動對帳。
   try{await reconcile(transaction)}catch{console.warn('ECPay stage reconciliation pending')}
  }
  return reply('1|OK');
 }catch{return reply('0|Retry later',500)}
});
