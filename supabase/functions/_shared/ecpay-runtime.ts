import { createClient } from 'npm:@supabase/supabase-js@2.119.0';
import {STAGE,checkMac,verifyMac,parseForm,fingerprint,paymentInfo} from './ecpay.mjs';
export function configuration(environment:string){
 if(environment==='stage')return STAGE;
 if(environment!=='production')throw Error('付款環境不正確。');
 const merchantId=Deno.env.get('ECPAY_MERCHANT_ID')||'',hashKey=Deno.env.get('ECPAY_HASH_KEY')||'',hashIV=Deno.env.get('ECPAY_HASH_IV')||'';
 if(merchantId!=='3096502'||hashKey.length!==16||hashIV.length!==16)throw Error('正式付款服務尚未完成設定。');
 return{merchantId,hashKey,hashIV,gateway:'https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5',query:'https://payment.ecpay.com.tw/Cashier/QueryTradeInfo/V5'};
}
export async function signature(transaction:any,params:Record<string,string>){const c=configuration(transaction.environment);return await verifyMac(params,c.hashKey,c.hashIV)}
export const projectUrl=Deno.env.get('SUPABASE_URL')!;
export const service=createClient(projectUrl,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
export const siteUrl='https://catstudio3d-cpu.github.io/WR/';
export async function result<T>(operation:PromiseLike<{data:T,error:any}>):Promise<T>{const r=await operation;if(r.error)throw Error(r.error.code==='P0001'&&r.error.message?.length<180?r.error.message:'付款資料暫時無法處理，請稍後再試。');return r.data}
export async function lookup(trade:string){return await result(service.from('ecpay_transactions').select('*').eq('merchant_trade_no',trade).maybeSingle())}
export async function apply(transaction:any,params:Record<string,string>,source:'notify'|'query',status:string,verified=false){
 return await result(service.rpc(transaction.environment==='production'?'academy_ecpay_production_apply':'academy_ecpay_stage_apply',{p_trade:transaction.merchant_trade_no,p_merchant:params.MerchantID,p_amount:Number(params.TradeAmt),p_status:status,p_trade_no:params.TradeNo||'',p_date:params.PaymentDate||'',p_rtn_code:params.RtnCode||params.TradeStatus||'',p_simulated:params.SimulatePaid==='1',p_verified:verified,p_source:source,p_fingerprint:await fingerprint(params,source)}));
}
export function matches(transaction:any,params:Record<string,string>){return transaction&&['stage','production'].includes(transaction.environment)&&params.MerchantID===transaction.merchant_id&&params.MerchantTradeNo===transaction.merchant_trade_no&&/^[0-9]+$/.test(params.TradeAmt||'')&&Number(params.TradeAmt)===Number(transaction.amount)}
export async function saveInfo(transaction:any,params:Record<string,string>,fromQuery=false){
 const parsed=paymentInfo(params,transaction.method,fromQuery);if(!parsed)throw Error('尚未取得繳費資訊。');
 return await result(service.rpc('academy_ecpay_stage_info',{p_trade:transaction.merchant_trade_no,p_merchant:params.MerchantID,p_amount:Number(params.TradeAmt),p_method:transaction.method,p_info:parsed.info,p_expires:parsed.expiresAt,p_fingerprint:await fingerprint(params,'info')}));
}
export async function reconcile(transaction:any){
 const now=Math.floor(Date.now()/1000);
 if(['test_paid','paid'].includes(transaction.status))return transaction;
 const config=configuration(transaction.environment);
 // 每筆交易最多每 30 秒主動查詢一次，以免觸發綠界 API 限流。
 const claimed=await result(service.from('ecpay_transactions').update({query_checked_at:now}).eq('id',transaction.id).lt('query_checked_at',now-30).select('id'));
 if(!claimed?.length)return transaction;
 const params:Record<string,string>={MerchantID:config.merchantId,MerchantTradeNo:transaction.merchant_trade_no,TimeStamp:String(now)};
 params.CheckMacValue=await checkMac(params,config.hashKey,config.hashIV);
 const response=await fetch(config.query,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(params),signal:AbortSignal.timeout(4500)});
 if(!response.ok)throw Error('綠界查詢暫時無法完成，請稍後再查詢。');
 const raw=await response.text();const answer=parseForm(raw);
 if(!await signature(transaction,answer)||!matches(transaction,answer))throw Error('綠界查詢結果尚未確認。');
 const status=answer.SimulatePaid==='1'?'simulated':answer.TradeStatus==='1'?(transaction.environment==='production'?'paid':'test_paid'):answer.TradeStatus==='0'?'pending':'failed';
 let updated=await apply(transaction,answer,'query',status,['paid','test_paid'].includes(status));
 if(status==='pending'&&['ATM','CVS','BARCODE'].includes(transaction.method)&&!Object.keys(updated.payment_info||{}).length){
  const infoResponse=await fetch(config.gateway.replace('/AioCheckOut/V5','/QueryPaymentInfo'),{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(params),signal:AbortSignal.timeout(4500)});
  if(!infoResponse.ok)throw Error('取號資訊暫時無法查詢。');const info=parseForm(await infoResponse.text());
  if(!await signature(transaction,info)||!matches(transaction,info))throw Error('取號資訊尚未確認。');updated=await saveInfo(updated,info,true);
 }
 return updated;
}
