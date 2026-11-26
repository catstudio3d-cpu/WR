// AIO 規格來源：https://developers.ecpay.com.tw/2866/、2878/、2890/、2902/
// 本版僅支援公開測試帳號；不接受前端切換正式環境。
export const STAGE = Object.freeze({merchantId:'3002607',hashKey:'pwFHCqoQZGmho4w6',hashIV:'EkRm7iFT261dpevs',gateway:'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5',query:'https://payment-stage.ecpay.com.tw/Cashier/QueryTradeInfo/V5'});
export async function sha256(text){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),b=>b.toString(16).padStart(2,'0')).join('')}
export function ecpayEncode(text){return encodeURIComponent(text).replace(/~/g,'%7E').replace(/'/g,'%27').replace(/%20/g,'+').toLowerCase()}
export async function checkMac(params,key=STAGE.hashKey,iv=STAGE.hashIV){
 const keys=Object.keys(params).filter(k=>k.toLowerCase()!=='checkmacvalue').sort((a,b)=>a.toLowerCase()<b.toLowerCase()?-1:a.toLowerCase()>b.toLowerCase()?1:0);
 const source='HashKey='+key+'&'+keys.map(k=>k+'='+String(params[k])).join('&')+'&HashIV='+iv;
 return (await sha256(ecpayEncode(source))).toUpperCase();
}
export function safeEqual(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let difference=0;for(let i=0;i<a.length;i++)difference|=a.charCodeAt(i)^b.charCodeAt(i);return difference===0}
export async function verifyMac(params){return /^[A-Fa-f0-9]{64}$/.test(params.CheckMacValue||'')&&safeEqual(await checkMac(params),params.CheckMacValue.toUpperCase())}
export function parseForm(body){
 if(new TextEncoder().encode(body).length>32768)throw Error('通知內容過大。');
 const params={},seen=new Set();
 for(const [key,value] of new URLSearchParams(body)){const normalized=key.toLowerCase();if(seen.has(normalized))throw Error('通知欄位重複。');seen.add(normalized);params[key]=value}
 return params;
}
export function tradeDate(seconds){
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(seconds*1000));
 const get=type=>parts.find(p=>p.type===type).value;
 return get('year')+'/'+get('month')+'/'+get('day')+' '+get('hour')+':'+get('minute')+':'+get('second');
}
export async function checkoutParams(payment,baseUrl,siteUrl){
 if(payment.environment!=='stage'||payment.merchant_id!==STAGE.merchantId||!Number.isSafeInteger(Number(payment.amount))||payment.amount<1||payment.amount>200000)throw Error('測試交易設定不正確。');
 const params={MerchantID:STAGE.merchantId,MerchantTradeNo:payment.merchant_trade_no,MerchantTradeDate:tradeDate(payment.created_at),PaymentType:'aio',TotalAmount:String(payment.amount),TradeDesc:'WR學院測試付款',ItemName:'馭野學院測試訂單',ReturnURL:baseUrl+'/ecpay-notify',ChoosePayment:'Credit',EncryptType:'1',ClientBackURL:siteUrl+'payment-result.html?order='+payment.order_id,OrderResultURL:baseUrl+'/ecpay-return'};
 params.CheckMacValue=await checkMac(params);return params;
}
export async function fingerprint(params,source){return sha256(source+'|'+Object.keys(params).sort().map(k=>k+'='+params[k]).join('&'))}
