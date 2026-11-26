window.WildRideProductImages=(()=>{
 async function prepare(file){
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024)throw Error('請選擇 10MB 以下的 JPG、PNG 或 WebP 圖片。');
  const url=URL.createObjectURL(file);
  try{
   const image=new Image();image.src=url;await image.decode();
   if(!image.naturalWidth||!image.naturalHeight||image.naturalWidth*image.naturalHeight>40000000)throw Error('圖片尺寸過大，請先縮小後再上傳。');
   const scale=Math.min(1,1600/Math.max(image.naturalWidth,image.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
   const ctx=canvas.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
   const data=canvas.toDataURL('image/jpeg',.84);if(data.length>1600000)throw Error('圖片壓縮後仍過大，請換一張圖片或先縮小。');return data;
  }finally{URL.revokeObjectURL(url)}
 }
 function attach(form,product,products){
  const create=(tag,text)=>{const e=document.createElement(tag);if(text)e.textContent=text;return e},label=(text,control)=>{const l=create('label',text);l.append(control);return l};
  const hidden=form.elements.namedItem('image'),pick=create('select'),preview=create('img'),file=create('input'),status=create('p'),wrap=create('div');wrap.className='wide';
  const images=new Map(products.map(p=>[p.image,p.name]));if(!images.has(product.image))images.set(product.image,'目前商品圖片');
  for(const [url,name]of images){const o=create('option',name);o.value=url;pick.append(o)}pick.value=product.image;pick.setAttribute('aria-label','選擇既有商品圖片');
  preview.src=product.image;preview.alt='商品圖片預覽';preview.className='admin-product-preview';file.type='file';file.accept='image/jpeg,image/png,image/webp';file.setAttribute('aria-label','上傳商品圖片');status.setAttribute('role','status');
  let prepared=null,pending=null,version=0,ready=false;
  pick.onchange=()=>{version++;prepared=null;pending=null;ready=false;file.value='';hidden.value=pick.value;preview.src=pick.value;status.textContent='已選擇既有圖片，儲存商品後生效。'};
  file.onchange=()=>{
   const current=++version,chosen=file.files?.[0];prepared=null;pending=null;ready=false;if(!chosen)return;
   status.textContent='正在處理圖片…';
   pending=prepare(chosen).then(data=>{if(current!==version)return;prepared=data;preview.src=data;status.textContent='圖片已備妥，按下儲存商品後會上傳並套用。'}).catch(error=>{if(current===version){file.value='';preview.src=hidden.value;status.textContent=error.message}throw error});
   // The save handler awaits the same promise; suppress an unhandled rejection before save.
   pending.catch(()=>{});
  };
  wrap.append(label('快速選擇圖片',pick),label('上傳商品圖片',file),create('small','支援 JPG、PNG、WebP，原始檔 10MB 以下；會自動縮圖。商品圖片將公開顯示。'),status,preview);form.append(wrap);
  return{async upload(){if(pending)await pending;if(prepared&&!ready){status.textContent='正在上傳商品圖片…';const result=await WildRideMember.request('admin/product-image',{image:prepared});hidden.value=result.image;ready=true;status.textContent='圖片已上傳，正在儲存商品…'}return hidden.value}};
 }
 return{attach,prepare};
})();
