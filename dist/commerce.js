window.WildRideShop=(()=>{
 const api=WildRideMember,key='wildride-cart-v1';let member=null;
 const guest=()=>{try{return JSON.parse(localStorage.getItem(key)||'{}')}catch{return {}}};
 const available=p=>p&&p.active!==false&&Number(p.price)>0;
 async function init(){member=(await api.session()).member;return member}
 async function items(){
  if(member)return(await api.request('cart')).items;
  const products=(await api.request('catalog')).products,g=guest();
  return products.filter(p=>g[p.id]>0).map(p=>({...p,quantity:Math.min(20,Number(g[p.id])||1)}));
 }
 async function set(id,quantity){
  if(!Number.isInteger(quantity)||quantity<0||quantity>20)throw Error('每項商品數量需為 0–20。');
  if(quantity>0){
   const products=(await api.request('catalog')).products;
   if(!available(products.find(p=>p.id===id)))throw Error('商品未上架，目前無法加入購物車。');
  }
  if(member)await api.request('cart',{id,quantity});
  else{const g=guest();if(quantity)g[id]=quantity;else delete g[id];localStorage.setItem(key,JSON.stringify(g))}
  document.dispatchEvent(new Event('cartchange'));
 }
 async function add(id){const all=await items(),p=all.find(p=>p.id===id);await set(id,Math.min(20,(p?.quantity||0)+1))}
 async function merge(){
  const products=(await api.request('catalog')).products;
  const pending=Object.entries(guest()).map(([id,quantity])=>({id,quantity:Math.min(20,Number(quantity)||1)}));
  if(pending.some(item=>!available(products.find(p=>p.id===item.id))))throw Error('訪客購物車有未上架商品，請先移除後再合併。');
  await api.request('cart/merge',{items:pending});localStorage.removeItem(key);
  document.dispatchEvent(new Event('cartchange'));
 }
 return{init,items,set,add,merge,hasGuest:()=>Object.keys(guest()).length>0,get member(){return member}};
})();
