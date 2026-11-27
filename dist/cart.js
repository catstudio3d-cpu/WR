const shop=WildRideShop,api=WildRideMember,$=id=>document.getElementById(id);let requestKey=crypto.randomUUID(),paymentReady=false,needsRegistration=false,paymentLimits={},supportedMethods=[],paymentEnvironment='production';
const chosenMethod=()=>document.querySelector('input[name="payment-method"]:checked')?.value;
const mobileWebATM=()=>/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const available=p=>p.active!==false&&p.demo===false&&Number(p.price)>0&&Number.isInteger(p.stock)&&p.stock>=p.quantity;
const quantityMax=p=>Math.min(Number.isInteger(p.stock)?p.stock:1000000,p.max_per_order||1000000);
const isRegistration=p=>['課程類','活動類'].includes(p.group);
function say(text,error=false){$('ops-status').textContent=text;$('ops-status').classList.toggle('error',error)}
function el(tag,text,cls){const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e}
async function act(fn){try{await fn()}catch(e){say(e.message,true)}}
async function render(){
 const items=await shop.items(),host=$('cart-items');host.replaceChildren();needsRegistration=items.some(isRegistration);
 for(const p of items){
  const row=el('article',null,'ops-row'),img=el('img');img.src=p.image;img.alt=p.name;
  const body=el('div',null,'grow');body.append(el('b',p.name),el('small',available(p)?'NT$'+p.price.toLocaleString():'未開放購買或名額／庫存不足，請移除後再結帳'));
  body.append(el('small',(isRegistration(p)?'報名人數':'購買數量')+'可自行調整；'+(p.max_per_order?'每筆最多 '+p.max_per_order+(isRegistration(p)?' 人。':' 件。'):'本商品未另設每筆上限，以剩餘名額／庫存為準。')));
  const qty=el('input');qty.type='number';qty.min=1;qty.max=quantityMax(p);qty.value=p.quantity;qty.disabled=!available(p);qty.setAttribute('aria-label',p.name+'數量');
  qty.onchange=()=>act(async()=>{try{const n=Number(qty.value);if(!Number.isInteger(n)||n<1||n>Number(qty.max))throw Error('請填寫 1–'+quantityMax(p)+' 的整數，並確認剩餘名額／庫存。');await shop.set(p.id,n);requestKey=crypto.randomUUID();await render()}catch(error){qty.value=p.quantity;throw error}});
  const remove=el('button','移除');remove.onclick=()=>act(async()=>{await shop.set(p.id,0);requestKey=crypto.randomUUID();await render()});row.append(img,body,qty,remove);host.append(row);
 }
 if(!items.length)host.append(el('p','購物車還沒有商品，先到馭野嚴選看看。'));
 $('cart-total').textContent='商品合計 NT$'+items.reduce((n,p)=>n+p.price*p.quantity,0).toLocaleString();
 const total=items.reduce((n,p)=>n+p.price*p.quantity,0);
 for(const radio of document.querySelectorAll('input[name="payment-method"]')){const limit=paymentLimits[radio.value];radio.disabled=!paymentReady||!supportedMethods.includes(radio.value)||!limit||total<limit.min||total>limit.max||(radio.value==='WebATM'&&mobileWebATM());radio.closest('label').style.opacity=radio.disabled?'.5':'1'}
 const selected=document.querySelector('input[name="payment-method"]:checked');if(selected?.disabled){selected.checked=false;const next=document.querySelector('input[name="payment-method"]:not(:disabled)');if(next)next.checked=true}
 $('registration-fields').hidden=!needsRegistration;
 for(const name of ['name','phone','bike']){$('registration-'+name).required=needsRegistration;$('registration-'+name).disabled=!needsRegistration}
 if(shop.member){if(!$('registration-name').value)$('registration-name').value=shop.member.name||'';if(!$('registration-bike').value)$('registration-bike').value=shop.member.profile?.bike||''}
 $('checkout').disabled=!items.length||!shop.member||!paymentReady||!chosenMethod()||items.some(p=>!available(p)||p.quantity>quantityMax(p));
 $('checkout').textContent=!shop.member?'請先登入會員':paymentReady?(['ATM','CVS','BARCODE'].includes(chosenMethod())?'前往綠界取得繳費資訊':'前往綠界付款'):'線上付款尚未開放';
 $('merge-guest').hidden=!shop.member||!shop.hasGuest();$('cart-auth').hidden=!!shop.member;
}
function registration(){return Object.fromEntries(['name','phone','bike'].map(k=>[k,$('registration-'+k).value.trim()]))}
function validateRegistration(){if(!needsRegistration)return{};const r=registration();if(!r.name||!r.bike||!/^\+?[0-9]{8,15}$/.test(r.phone.replace(/[ ()-]/g,'')))throw Error('請填寫報名姓名、有效手機與自備車款。');return r}
for(const id of ['registration-name','registration-phone','registration-bike','order-note'])$(id).addEventListener('input',()=>{requestKey=crypto.randomUUID()});
let submitting=false;
$('payment-options').addEventListener('change',()=>{requestKey=crypto.randomUUID();act(render)});
$('merge-guest').onclick=()=>act(async()=>{await shop.merge();requestKey=crypto.randomUUID();await render();say('訪客購物車已合併至目前會員。')});
$('checkout-form').onsubmit=e=>{
 e.preventDefault();if(submitting)return;submitting=true;$('checkout').disabled=true;
 act(async()=>{try{
  if(!paymentReady||!shop.member)throw Error('目前尚未開放此帳號進行付款。');
  const current=await shop.items();if(!current.length||current.some(p=>!available(p)||p.quantity>quantityMax(p)))throw Error('請確認商品已上架、人數／數量未超過每筆上限及剩餘名額。');
  const method=chosenMethod();if(!method)throw Error('請選擇適用的付款方式。');const payment=await api.request('payment/create',{requestKey,note:$('order-note').value,registration:validateRegistration(),method});WildRidePayment.submit(payment);
 }finally{submitting=false;await render()}});
};
shop.init().then(async()=>{
 try{const config=await WildRidePayment.config();paymentLimits=config.limits||{};supportedMethods=config.methods||[];paymentEnvironment=config.environment;paymentReady=config.enabled&&config.environment==='production'&&!!shop.member&&(!config.adminOnly||shop.member.role==='admin');$('payment-availability').textContent=paymentReady?'正式付款：完成付款後請回會員中心確認紀錄。ATM 與超商取號不代表已繳費。':'請登入會員後進行付款；若服務暫停，請聯絡學院。'}catch{$('payment-availability').textContent='付款服務暫時無法使用，請稍後再試。'}
 await render();
}).catch(e=>say(e.message,true));
