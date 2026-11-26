import { createClient } from 'npm:@supabase/supabase-js@2.119.0';
import {STAGE,checkMac,verifyMac,parseForm,fingerprint} from './ecpay.mjs';
export const projectUrl=Deno.env.get('SUPABASE_URL')!;
export const service=createClient(projectUrl,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
export const siteUrl='https://catstudio3d-cpu.github.io/WR/';
export async function result<T>(operation:PromiseLike<{data:T,error:unknown}>):Promise<T>{const r=await operation;if(r.error)throw Error('付款資料暫時無法處理，請稍後再試。');return r.data}
export async function lookup(trade:string){return await result(service.from('ecpay_transactions').select('*').eq('merchant_trade_no',trade).maybeSingle())}
export async function apply(transaction:any,params:Record<string,string>,source:'notify'|'query',status:string,verified=false){
 return await result(service.rpc('academy_ecpay_stage_apply',{p_trade:transaction.merchant_trade_no,p_merchant:params.MerchantID,p_amount:Number(params.TradeAmt),p_status:status,p_trade_no:params.TradeNo||'',p_date:params.PaymentDate||'',p_rtn_code:params.RtnCode||params.TradeStatus||'',p_simulated:params.SimulatePaid==='1',p_verified:verified,p_source:source,p_fingerprint:await fingerprint(params,source)}));
}
export function matches(transaction:any,params:Record<string,string>){return transaction&&transaction.environment==='stage'&&params.MerchantID===transaction.merchant_id&&params.MerchantTradeNo===transaction.merchant_trade_no&&/^[0-9]+$/.test(params.TradeAmt||'')&&Number(params.TradeAmt)===Number(transaction.amount)}
export async function reconcile(transaction:any){
 const now=Math.floor(Date.now()/1000);
 if(transaction.status==='test_paid')return transaction;
 // 每筆交易最多每 30 秒主動查詢一次，以免觸發綠界 API 限流。
 const claimed=await result(service.from('ecpay_transactions').update({query_checked_at:now}).eq('id',transaction.id).lt('query_checked_at',now-30).select('id'));
 if(!claimed?.length)return transaction;
 const params:Record<string,string>={MerchantID:STAGE.merchantId,MerchantTradeNo:transaction.merchant_trade_no,TimeStamp:String(now)};
 params.CheckMacValue=await checkMac(params);
 const response=await fetch(STAGE.query,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(params),signal:AbortSignal.timeout(4500)});
 if(!response.ok)throw Error('綠界查詢暫時無法完成，請稍後再查詢。');
 const raw=await response.text();const answer=parseForm(raw);
 if(!await verifyMac(answer)||!matches(transaction,answer))throw Error('綠界查詢結果尚未確認。');
 const status=answer.SimulatePaid==='1'?'simulated':answer.TradeStatus==='1'?'test_paid':answer.TradeStatus==='0'?'pending':'failed';
 return await apply(transaction,answer,'query',status,status==='test_paid');
}
