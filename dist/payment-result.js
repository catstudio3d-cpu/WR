(()=>{
 const orderId=new URLSearchParams(location.search).get('order'),$=id=>document.getElementById(id),title=$('payment-title'),summary=$('payment-summary'),message=$('payment-message'),refresh=$('payment-refresh'),details=$('payment-details');let attempts=0;
 const names={Credit:'信用卡一次付清',ATM:'ATM 虛擬帳號',WebATM:'WebATM 網路轉帳',CVS:'超商代碼',BARCODE:'超商條碼'};
 function line(label,value){const p=document.createElement('p'),b=document.createElement('b');b.textContent=label+'：';p.append(b,document.createTextNode(value||'尚未提供'));details.append(p)}
 function showDetails(p){
  details.replaceChildren();const info=p.paymentInfo||{};details.hidden=p.status!=='pending'||!info.method;
  if(details.hidden)return;
  const heading=document.createElement('h3');heading.textContent=p.environment==='stage'?'測試繳費資訊':'繳費資訊';details.append(heading);
  line('付款方式',names[p.method]||p.method);line(info.method==='CVS'?'繳款單列印期限':'繳費期限',info.expires+'（台灣時間）');
  if(p.expired)line('期限提醒',info.method==='CVS'?'列印期限已過；若已列印，請以繳款單期限為準，付款結果仍待確認。':'繳費期限已過；請先查詢付款結果，再與學院確認後續處理。');
  if(info.method==='ATM'){line('銀行代碼',info.bankCode);line('虛擬帳號',info.account)}
  if(info.method==='CVS'){line('繳費代碼',info.code);line('提醒','需於期限內列印繳款單；實際繳費期限依超商繳款單標示。')}
  if(info.method==='BARCODE'){
   for(const [index,code]of (info.barcodes||[]).entries()){
    line('第 '+(index+1)+' 段',code);const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('aria-label','第 '+(index+1)+' 段超商條碼');details.append(svg);
    try{JsBarcode(svg,code,{format:'CODE39',width:2,height:58,displayValue:true,fontSize:16,margin:16})}catch{svg.remove();line('條碼提醒','無法繪製，請回綠界查看原始繳費單。')}
   }
   const print=document.createElement('button');print.type='button';print.textContent=p.environment==='stage'?'列印測試條碼':'列印繳費條碼';print.onclick=()=>window.print();details.append(print);line('入帳提醒','超商條碼付款結果可能延遲 2–3 天；取號與列印不代表已付款。');
  }
  if(p.environment==='stage')line('測試提醒','這是綠界測試資料，請勿實際轉帳或到超商付款。');
 }
 async function read(action='status'){
  refresh.disabled=true;
  try{
   const result=await WildRideMember.request('payment/'+action,{orderId}),p=result.payment,test=p.environment==='stage',issued=p.status==='pending'&&p.paymentInfo?.method;
   title.textContent=p.status==='pending'?(issued?(test?'已取號，等待測試付款':'已取號，等待付款'):(test?'等待測試付款確認':'等待付款確認')):WildRidePayment.label(p.status);
   summary.textContent=(test?'測試金額 NT$':'訂單金額 NT$')+Number(p.amount).toLocaleString('zh-TW')+' · '+(names[p.method]||'信用卡一次付清')+' · 交易編號 '+p.tradeNo;
   message.textContent=result.warning||(p.status==='pending'?(issued?'取號不代表繳費完成。付款確認後，才會列入'+(test?'測試':'正式')+'報名名單。':'尚未確認結果。若剛取號或付款，請稍候再查詢。'):(test?'此紀錄僅供流程測試，不代表正式繳費或報名完成。':p.status==='paid'?'已確認收款，可至會員中心查看訂單。':p.status==='simulated'?'此為模擬通知，未確認實際收款。':'尚未完成付款，請聯絡學院確認後續處理。'));
   refresh.hidden=['paid','test_paid'].includes(p.status);showDetails(p);
   if(p.status==='pending'&&action==='status'&&attempts++<4)setTimeout(()=>read('status'),3000);
  }catch(e){title.textContent='暫時無法讀取付款紀錄';message.textContent=e.message;details.hidden=true}
  finally{refresh.disabled=false}
 }
 refresh.onclick=()=>read('refresh');
 WildRideMember.session().then(({member})=>{if(!member){title.textContent='請先登入會員';$('payment-login').hidden=false;return}if(!orderId||!/^[a-f0-9-]{36}$/i.test(orderId)){title.textContent='請從會員中心查看付款紀錄';return}read()}).catch(e=>{title.textContent='付款紀錄待查詢';message.textContent=e.message});
})();
