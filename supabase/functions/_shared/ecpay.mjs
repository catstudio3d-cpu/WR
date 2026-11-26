// AIO 規格來源：https://developers.ecpay.com.tw/2866/、2878/、2890/、2902/
// 正式密鑰僅由後端環境變數提供；不接受前端切換商店。
export const STAGE = Object.freeze({merchantId:'3002607',hashKey:'pwFHCqoQZGmho4w6',hashIV:'EkRm7iFT261dpevs',gateway:'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5',query:'https://payment-stage.ecpay.com.tw/Cashier/QueryTradeInfo/V5'});
export const METHODS=Object.freeze({Credit:{name:'信用卡一次付清',min:6,max:200000},ATM:{name:'ATM 虛擬帳號',min:16,max:49999},WebATM:{name:'WebATM 網路轉帳',min:16,max:49999},CVS:{name:'超商代碼',min:34,max:6000},BARCODE:{name:'超商條碼',min:18,max:20000}});
export async function sha256(text){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),b=>b.toString(16).padStart(2,'0')).join('')}
export function ecpayEncode(text){return encodeURIComponent(text).replace(/~/g,'%7E').replace(/'/g,'%27').replace(/%20/g,'+').toLowerCase()}
export async function checkMac(params,key=STAGE.hashKey,iv=STAGE.hashIV){
 const keys=Object.keys(params).filter(k=>k.toLowerCase()!=='checkmacvalue').sort((a,b)=>a.toLowerCase()<b.toLowerCase()?-1:a.toLowerCase()>b.toLowerCase()?1:0);
 const source='HashKey='+key+'&'+keys.map(k=>k+'='+String(params[k])).join('&')+'&HashIV='+iv;
 return (await sha256(ecpayEncode(source))).toUpperCase();
}
export function safeEqual(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let difference=0;for(let i=0;i<a.length;i++)difference|=a.charCodeAt(i)^b.charCodeAt(i);return difference===0}
export async function verifyMac(params,key=STAGE.hashKey,iv=STAGE.hashIV){return /^[A-Fa-f0-9]{64}$/.test(params.CheckMacValue||'')&&safeEqual(await checkMac(params,key,iv),params.CheckMacValue.toUpperCase())}
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
export async function checkoutParams(payment,baseUrl,siteUrl,config=STAGE){
 if(payment.environment!==(config===STAGE?'stage':'production')||payment.merchant_id!==config.merchantId||!Number.isSafeInteger(Number(payment.amount))||payment.amount<1||payment.amount>200000)throw Error('交易設定不正確。');
 const method=payment.method||'Credit',limit=Object.hasOwn(METHODS,method)?METHODS[method]:null;if(!limit||payment.amount<limit.min||payment.amount>limit.max)throw Error('訂單金額不適用此付款方式。');
 const params={MerchantID:config.merchantId,MerchantTradeNo:payment.merchant_trade_no,MerchantTradeDate:tradeDate(payment.created_at),PaymentType:'aio',TotalAmount:String(payment.amount),TradeDesc:config===STAGE?'WR學院測試付款':'馭野騎乘學院線上付款',ItemName:config===STAGE?'馭野學院測試訂單':(payment.item_name||'馭野騎乘學院訂單'),ReturnURL:baseUrl+'/ecpay-notify',ChoosePayment:method,EncryptType:'1',ClientBackURL:siteUrl+'payment-result.html?order='+payment.order_id};
 if(['ATM','CVS','BARCODE'].includes(method)){params.PaymentInfoURL=baseUrl+'/ecpay-info';params.ClientRedirectURL=baseUrl+'/ecpay-return';if(method==='ATM')params.ExpireDate='3';else params.StoreExpireDate=method==='CVS'?'4320':'3'}else{params.OrderResultURL=baseUrl+'/ecpay-return';if(method==='Credit')params.Redeem='N'}
 params.CheckMacValue=await checkMac(params,config.hashKey,config.hashIV);return params;
}
export async function fingerprint(params,source){return sha256(source+'|'+Object.keys(params).sort().map(k=>k+'='+params[k]).join('&'))}
export function expirySeconds(value){
 const m=/^(\d{4})[/-](\d{2})[/-](\d{2})(?: (\d{2}):(\d{2}):(\d{2}))?$/.exec(value||'');if(!m)throw Error('繳費期限格式不正確。');
 const h=m[4]||'23',min=m[5]||'59',sec=m[6]||'59',ts=Date.UTC(+m[1],+m[2]-1,+m[3],+h-8,+min,+sec)/1000;
 if(tradeDate(ts)!==m[1]+'/'+m[2]+'/'+m[3]+' '+h+':'+min+':'+sec)throw Error('繳費期限不正確。');return ts;
}
export function paymentInfo(params,method,fromQuery=false){
 if(!['ATM','CVS','BARCODE'].includes(method))return null;
 const code=method==='ATM'?'2':'10100073';if(params.RtnCode!==code&&!(fromQuery&&params.RtnCode==='1'))return null;
 if(!(params.PaymentType||'').startsWith(method+'_'))throw Error('取號付款方式不符。');
 const info={method,expires:params.ExpireDate};const expiresAt=expirySeconds(params.ExpireDate);
 if(method==='ATM'){if(!/^\d{3}$/.test(params.BankCode||'')||!/^\d{1,16}$/.test(params.vAccount||''))throw Error('虛擬帳號資訊不正確。');info.bankCode=params.BankCode;info.account=params.vAccount}
 if(method==='CVS'){if(!/^[A-Za-z0-9]{1,14}$/.test(params.PaymentNo||''))throw Error('超商代碼不正確。');info.code=params.PaymentNo}
 if(method==='BARCODE'){info.barcodes=[params.Barcode1,params.Barcode2,params.Barcode3];if(!info.barcodes.every(x=>typeof x==='string'&&/^[A-Z0-9. $/+%\-]{1,20}$/.test(x)))throw Error('超商條碼不正確。')}
 return{info,expiresAt};
}
