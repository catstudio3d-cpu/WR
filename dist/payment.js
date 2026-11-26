window.WildRidePayment=(()=>{
 const endpoint=()=>WildRideConfig.supabaseUrl+'/functions/v1/ecpay-checkout';
 const labels={not_requested:'未申請線上付款',pending:'等待測試付款確認',test_paid:'測試付款完成（未實際收款）',failed:'測試付款失敗',simulated:'模擬通知（未實際付款）'};
 async function config(){if(WildRideMember.mode!=='supabase')return{enabled:false};const response=await fetch(endpoint());if(!response.ok)throw Error('付款服務暫時無法使用。');return response.json()}
 function submit(payment){
  if(payment.environment!=='stage'||payment.gateway!=='https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5')throw Error('付款環境不正確。');
  const form=document.createElement('form');form.method='POST';form.action=payment.gateway;form.hidden=true;
  for(const [name,value]of Object.entries(payment.params)){if(['HashKey','HashIV'].includes(name))throw Error('付款資料不正確。');const input=document.createElement('input');input.type='hidden';input.name=name;input.value=String(value);form.append(input)}
  document.body.append(form);form.submit();
 }
 return{config,submit,label:status=>labels[status]||'付款待確認'};
})();
