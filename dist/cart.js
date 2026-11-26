const shop=WildRideShop,api=WildRideMember,$=id=>document.getElementById(id);let requestKey=crypto.randomUUID(),paymentReady=false,needsRegistration=false;
const available=p=>p.active!==false&&Number(p.price)>0;
const isRegistration=p=>['課程類','活動類'].includes(p.group);
function say(text,error=false){$('ops-status').textContent=text;$('ops-status').classList.toggle('error',error)}
function el(tag,text,cls){const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e}
async function act(fn){try{await fn()}catch(e){say(e.message,true)}}
async function render(){
 const items=await shop.items(),host=$('cart-items');host.replaceChildren();needsRegistration=items.some(isRegistration);
 for(const p of items){
  const row=el('article',null,'ops-row'),img=el('img');img.src=p.image;img.alt=p.name;
  const body=el('div',null,'grow');body.append(el('b',p.name),el('small',available(p)?'NT$'+p.price.toLocaleString():'未上架，請移除後再結帳'));
  if(isRegistration(p))body.append(el('small','每個會員限報名一位，數量請設為 1。'));
  const qty=el('input');qty.type='number';qty.min=1;qty.max=isRegistration(p)?1:20;qty.value=p.quantity;qty.disabled=!available(p);qty.setAttribute('aria-label',p.name+'數量');
  qty.onchange=()=>act(async()=>{const n=Number(qty.value);if(!Number.isInteger(n)||n<1||n>Number(qty.max))throw Error(isRegistration(p)?'課程與活動數量需為 1。':'數量需為 1–20。');await shop.set(p.id,n);requestKey=crypto.randomUUID();await render()});
  const remove=el('button','移除');remove.onclick=()=>act(async()=>{await shop.set(p.id,0);requestKey=crypto.randomUUID();await render()});row.append(img,body,qty,remove);host.append(row);
 }
 if(!items.length)host.append(el('p','購物車還沒有商品，先到馭野嚴選看看。'));
 $('cart-total').textContent='商品合計 NT$'+items.reduce((n,p)=>n+p.price*p.quantity,0).toLocaleString();
 $('registration-fields').hidden=!needsRegistration;
 for(const name of ['name','phone','bike']){$('registration-'+name).required=needsRegistration;$('registration-'+name).disabled=!needsRegistration}
 if(shop.member){if(!$('registration-name').value)$('registration-name').value=shop.member.name||'';if(!$('registration-bike').value)$('registration-bike').value=shop.member.profile?.bike||''}
 $('checkout').disabled=!items.length||!shop.member||!paymentReady||items.some(p=>!available(p)||(isRegistration(p)&&p.quantity!==1));
 $('checkout').textContent=!shop.member?'請先登入會員':paymentReady?'前往綠界測試付款':'線上付款尚未開放';
 $('merge-guest').hidden=!shop.member||!shop.hasGuest();$('cart-auth').hidden=!!shop.member;
}
function registration(){return Object.fromEntries(['name','phone','bike'].map(k=>[k,$('registration-'+k).value.trim()]))}
function validateRegistration(){if(!needsRegistration)return{};const r=registration();if(!r.name||!r.bike||!/^\+?[0-9]{8,15}$/.test(r.phone.replace(/[ ()-]/g,'')))throw Error('請填寫報名姓名、有效手機與自備車款。');return r}
for(const id of ['registration-name','registration-phone','registration-bike','order-note'])$(id).addEventListener('input',()=>{requestKey=crypto.randomUUID()});
let submitting=false;
$('merge-guest').onclick=()=>act(async()=>{await shop.merge();requestKey=crypto.randomUUID();await render();say('訪客購物車已合併至目前會員。')});
$('checkout-form').onsubmit=e=>{
 e.preventDefault();if(submitting)return;submitting=true;$('checkout').disabled=true;
 act(async()=>{try{
  if(!paymentReady||!shop.member)throw Error('目前尚未開放此帳號進行付款。');
  const current=await shop.items();if(!current.length||current.some(p=>!available(p)||(isRegistration(p)&&p.quantity!==1)))throw Error('請確認商品已上架；課程與活動每項數量需為 1。');
  const payment=await api.request('payment/create',{requestKey,note:$('order-note').value,registration:validateRegistration()});WildRidePayment.submit(payment);
 }finally{submitting=false;await render()}});
};
shop.init().then(async()=>{
 try{const config=await WildRidePayment.config();paymentReady=config.enabled&&config.environment==='stage'&&shop.member?.role==='admin';$('payment-availability').textContent=paymentReady?'管理者測試環境：請使用綠界測試卡，不代表正式繳費或報名完成。':'目前僅開放管理者測試；一般會員線上付款與正式報名籌備中。'}catch{$('payment-availability').textContent='付款服務暫時無法使用，請稍後再試。'}
 await render();
}).catch(e=>say(e.message,true));
