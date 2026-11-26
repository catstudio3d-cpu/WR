(()=>{
 const orderId=new URLSearchParams(location.search).get('order');const title=document.getElementById('payment-title'),summary=document.getElementById('payment-summary'),message=document.getElementById('payment-message'),refresh=document.getElementById('payment-refresh');let attempts=0;
 async function read(action='status'){
  refresh.disabled=true;
  try{
   const result=await WildRideMember.request('payment/'+action,{orderId});const p=result.payment;
   title.textContent=WildRidePayment.label(p.status);summary.textContent='測試金額 NT$'+Number(p.amount).toLocaleString('zh-TW')+' · 交易編號 '+p.tradeNo;
   message.textContent=result.warning||(p.status==='pending'?'尚未確認付款結果。若剛完成測試，請稍候再查詢。':'此紀錄僅供流程測試，不代表正式繳費或報名完成。');
   refresh.hidden=p.status==='test_paid';
   if(p.status==='pending'&&action==='status'&&attempts++<4)setTimeout(()=>read('status'),3000);
  }catch(e){title.textContent='暫時無法讀取付款紀錄';message.textContent=e.message}
  finally{refresh.disabled=false}
 }
 refresh.onclick=()=>read('refresh');
 WildRideMember.session().then(({member})=>{
  if(!member){title.textContent='請先登入會員';document.getElementById('payment-login').hidden=false;return}
  if(!orderId||!/^[a-f0-9-]{36}$/i.test(orderId)){title.textContent='請從會員中心查看付款紀錄';return}
  read();
 }).catch(e=>{title.textContent='付款紀錄待查詢';message.textContent=e.message});
})();
