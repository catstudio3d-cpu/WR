/* Show total units, rather than the number of different products. */
(()=>{
 const links=[...document.querySelectorAll('header a[href="cart.html"]')];
 if(!links.length)return;
 const badges=links.map(link=>{
  const badge=document.createElement('span');
  badge.className='cart-badge';badge.hidden=true;badge.setAttribute('aria-hidden','true');
  link.classList.add('cart-nav-link');link.append(badge);return badge;
 });
 const guestKey='wildride-cart-v1',signalKey='wildride-cart-refresh';
 let revision=0;
 function paint(count){
  badges.forEach((badge,i)=>{
   badge.textContent=String(count);badge.hidden=count===0;
   links[i].setAttribute('aria-label',count?'購物車，共 '+count+' 件商品':'購物車');
  });
 }
 function total(items){return items.reduce((sum,item)=>{
  const quantity=Number(item.quantity);
  return sum+(Number.isInteger(quantity)&&quantity>0?Math.min(20,quantity):0);
 },0)}
 async function refresh(){
  const current=++revision;
  try{
   const {member}=await WildRideMember.session();
   let count;
   if(member){count=total((await WildRideMember.request('cart')).items||[])}
   else{
    let guest;try{guest=JSON.parse(localStorage.getItem(guestKey)||'{}')}catch{guest={}}
    const entries=guest&&typeof guest==='object'&&!Array.isArray(guest)?Object.values(guest):[];
    count=total(entries.map(quantity=>({quantity})));
   }
   if(current===revision)paint(count);
  }catch{if(current===revision)paint(0)}
 }
 function changed(){
  refresh();
  try{localStorage.setItem(signalKey,crypto.randomUUID())}catch{}
 }
 document.addEventListener('cartchange',changed);
 document.addEventListener('memberchange',changed);
 window.addEventListener('storage',event=>{
  if(event.key===guestKey||event.key===signalKey||event.key===null)refresh();
 });
 window.addEventListener('pageshow',refresh);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
 refresh();
})();
