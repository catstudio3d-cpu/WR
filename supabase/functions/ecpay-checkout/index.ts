import {service,result,configuration,reconcile,verifyUnpaid,projectUrl,siteUrl} from '../_shared/ecpay-runtime.ts';
import {STAGE,METHODS,checkoutParams} from '../_shared/ecpay.mjs';
// verify_jwt=false：下方以 Auth.getUser 驗證登入，避免依賴可偽造的前端角色。
Deno.serve(async request=>{
 const origin=request.headers.get('Origin')||'';
 const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':origin==='https://catstudio3d-cpu.github.io'?origin:'null','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Cache-Control':'no-store','Vary':'Origin'};
 const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(origin&&origin!=='https://catstudio3d-cpu.github.io')return reply({error:'不允許的網站來源。'},403);
 if(request.method==='GET'){try{configuration('production');return reply({enabled:true,environment:'production',adminOnly:false,methods:Object.keys(METHODS),limits:METHODS})}catch{return reply({enabled:false,environment:'production',adminOnly:false,methods:[],limits:METHODS})}}
 if(request.method!=='POST')return reply({error:'不支援的操作。'},405);
 try{
  const token=(request.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
  const {data:auth,error}=await service.auth.getUser(token);
  if(error||!auth.user)return reply({error:'請先登入會員。'},401);
  if(Number(request.headers.get('content-length')||0)>4096)return reply({error:'請求過大。'},413);
  const raw=await request.text();if(raw.length>4096)return reply({error:'請求過大。'},413);
  const body=JSON.parse(raw);const action=body.action||'create';
  const role=await result(service.from('user_roles').select('role').eq('user_id',auth.user.id).maybeSingle());
  const admin=role?.role==='admin';
  if(action==='create'){
   if(typeof body.requestKey!=='string'||!/^[A-Za-z0-9-]{16,80}$/.test(body.requestKey)||typeof(body.note??'')!=='string'||(body.note||'').length>500)return reply({error:'訂單資料不正確。'},400);
   const method=body.method||'Credit';if(typeof method!=='string'||!Object.hasOwn(METHODS,method))return reply({error:'付款方式不正確。'},400);
   const created=await result(service.rpc('academy_ecpay_production_order',{p_user:auth.user.id,p_request_key:body.requestKey,p_note:body.note||'',p_registration:body.registration||{},p_method:method,p_merchant:configuration('production').merchantId}));
   if(created.payment.status!=='pending')return reply({error:'此訂單已處理，請至會員中心查看。'},409);
   if(Math.floor(Date.now()/1000)-created.payment.created_at>600)return reply({error:'付款頁已逾時，請至會員中心查詢訂單。'},409);
   return reply({order:created.order,environment:'production',gateway:configuration('production').gateway,params:await checkoutParams({...created.payment,item_name:created.order.items.map((i:any)=>i.name+' × '+i.quantity).join('#').slice(0,400)},projectUrl+'/functions/v1',siteUrl,configuration('production'))});
  }
  if(!['status','refresh','delete'].includes(action)||typeof body.orderId!=='string'||!/^[a-f0-9-]{36}$/i.test(body.orderId))return reply({error:'查詢資料不正確。'},400);
  if(action==='delete'&&!admin)return reply({error:'僅管理者可刪除未付款訂單。'},403);
  let payment=await result(service.from('ecpay_transactions').select('*').eq('order_id',body.orderId).maybeSingle());
  const order=await result(service.from('orders').select('id,user_id,deleted_at,payment_review_required').eq('id',body.orderId).maybeSingle());
  if(action==='delete'){
   if(!order)return reply({error:'找不到訂單。'},404);
   let check={verification:'',checkedAt:0};
   if(payment?.environment==='production'&&!order.deleted_at)check=await verifyUnpaid(payment);
   return reply(await result(service.rpc('academy_delete_unpaid_order',{p_actor:auth.user.id,p_order:body.orderId,p_verification:check.verification,p_verified_trade:payment?.merchant_trade_no||'',p_checked_at:check.checkedAt})));
  }
  if(payment&&!admin&&payment.user_id!==auth.user.id)return reply({error:'無權查看此訂單。'},403);
  if(!payment)return reply({error:'找不到付款訂單。'},404);
  // 會員只可查看自己的付款；管理者可核對所有訂單。
  let warning='';if(action==='refresh'){try{payment=await reconcile(payment)}catch(e){warning=e instanceof Error?e.message:'查詢暫時無法完成。'}}
  return reply({payment:{orderId:payment.order_id,status:payment.status,amount:payment.amount,environment:payment.environment,tradeNo:payment.merchant_trade_no,paymentDate:payment.payment_date,method:payment.method,paymentInfo:order?.deleted_at?{}:payment.payment_info,deletedAt:order?.deleted_at,paymentReviewRequired:order?.payment_review_required,expiresAt:payment.expires_at,expired:payment.status==='pending'&&payment.expires_at&&payment.expires_at<Math.floor(Date.now()/1000)},warning});
 }catch(e){return reply({error:e instanceof Error&&/^[\u3400-\u9fff]/.test(e.message)?e.message:'無法建立或查詢付款，請確認商品售價、上架狀態與購物車。'},400)}
});
