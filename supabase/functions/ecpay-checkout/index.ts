import {service,result,reconcile,projectUrl,siteUrl} from '../_shared/ecpay-runtime.ts';
import {STAGE,checkoutParams} from '../_shared/ecpay.mjs';
// verify_jwt=false：下方以 Auth.getUser 驗證登入，避免依賴可偽造的前端角色。
Deno.serve(async request=>{
 const origin=request.headers.get('Origin')||'';
 const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':origin==='https://catstudio3d-cpu.github.io'?origin:'null','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Cache-Control':'no-store','Vary':'Origin'};
 const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(origin&&origin!=='https://catstudio3d-cpu.github.io')return reply({error:'不允許的網站來源。'},403);
 if(request.method==='GET')return reply({enabled:true,environment:'stage',adminOnly:true,methods:['Credit']});
 if(request.method!=='POST')return reply({error:'不支援的操作。'},405);
 try{
  const token=(request.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
  const {data:auth,error}=await service.auth.getUser(token);
  if(error||!auth.user)return reply({error:'請先登入會員。'},401);
  if(Number(request.headers.get('content-length')||0)>4096)return reply({error:'請求過大。'},413);
  const raw=await request.text();if(raw.length>4096)return reply({error:'請求過大。'},413);
  const body=JSON.parse(raw);const action=body.action||'create';
  const role=await result(service.from('user_roles').select('role').eq('user_id',auth.user.id).maybeSingle());
  if(role?.role!=='admin')return reply({error:'綠界測試付款僅供學院管理者使用。'},403);
  if(action==='create'){
   if(typeof body.requestKey!=='string'||!/^[A-Za-z0-9-]{16,80}$/.test(body.requestKey)||typeof(body.note??'')!=='string'||(body.note||'').length>500)return reply({error:'訂單資料不正確。'},400);
   const created=await result(service.rpc('academy_ecpay_stage_register',{p_user:auth.user.id,p_request_key:body.requestKey,p_note:body.note||'',p_registration:body.registration||{}}));
   if(created.payment.status!=='pending')return reply({error:'此測試訂單已處理，請至會員中心查看。'},409);
   if(Math.floor(Date.now()/1000)-created.payment.created_at>600)return reply({error:'付款頁已逾時，請至會員中心查詢測試訂單。'},409);
   return reply({order:created.order,environment:'stage',gateway:STAGE.gateway,params:await checkoutParams(created.payment,projectUrl+'/functions/v1',siteUrl)});
  }
  if(!['status','refresh'].includes(action)||typeof body.orderId!=='string'||!/^[a-f0-9-]{36}$/i.test(body.orderId))return reply({error:'查詢資料不正確。'},400);
  let payment=await result(service.from('ecpay_transactions').select('*').eq('order_id',body.orderId).maybeSingle());
  if(!payment)return reply({error:'找不到綠界測試訂單。'},404);
  // 管理者可查核所有測試訂單；一般會員在本版無法建立測試付款。
  let warning='';if(action==='refresh'){try{payment=await reconcile(payment)}catch(e){warning=e instanceof Error?e.message:'查詢暫時無法完成。'}}
  return reply({payment:{orderId:payment.order_id,status:payment.status,amount:payment.amount,environment:payment.environment,tradeNo:payment.merchant_trade_no,paymentDate:payment.payment_date},warning});
 }catch{return reply({error:'無法建立或查詢付款，請確認商品售價、上架狀態與購物車。'},400)}
});
