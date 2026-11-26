import {parseForm,verifyMac} from '../_shared/ecpay.mjs';
import {lookup,matches,siteUrl} from '../_shared/ecpay-runtime.ts';
// 接收綠界前端 POST，303 導回 GitHub Pages；此入口不更新付款狀態。
Deno.serve(async request=>{
 const fallback=siteUrl+'payment-result.html';
 let location=fallback;
 if(request.method==='POST'){
  try{
   if(Number(request.headers.get('content-length')||0)>32768)throw Error('Payload too large');
   const params=parseForm(await request.text());
   if(await verifyMac(params)){const transaction=await lookup(params.MerchantTradeNo||'');if(matches(transaction,params))location+='?order='+transaction.order_id}
  }catch{/* 僅導回查詢頁，不信任前端回傳的付款結果。 */}
 }
 return new Response(null,{status:303,headers:{Location:location,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
});
