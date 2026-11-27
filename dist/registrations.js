window.WildRideRegistrations=(()=>{
 let active=0;
 const columns=[['name','報名聯絡人'],['memberName','會員名稱'],['email','Email'],['phone','手機'],['bike','自備車款'],['productName','課程／活動'],['category','分類'],['quantity','人數'],['itemTotal','品項金額'],['orderTotal','訂單總額'],['paidAt','付款確認時間'],['tradeNo','交易編號'],['orderId','訂單編號'],['environment','付款環境'],['missingDetails','資料完整度']];
 const cell=(r,key)=>key==='paidAt'?new Date(r[key]*1000).toLocaleString('zh-TW'):key==='environment'?(r[key]==='stage'?'測試付款':'正式付款'):key==='missingDetails'?(r[key]?'資料待補':'完整'):String(r[key]??'');
 function node(tag,text){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n}
 function csvCell(value){let s=String(value);if(/^[\s\uFEFF]*[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"'}
 function exportCsv(rows,kind,test){const content='\uFEFF'+[columns.map(c=>csvCell(c[1])).join(','),...rows.map(r=>columns.map(([key])=>csvCell(cell(r,key))).join(','))].join('\r\n');const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'})),a=node('a');a.href=url;a.download=kind+'報名表_'+(test?'測試':'已繳費')+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
 async function render(host,kind){
  const serial=++active,p=node('section');p.className='ops-panel';p.append(node('h2',kind==='課程類'?'課程報名表':'活動報名表'),node('p','依付款確認紀錄自動收集報名聯絡人與人數，多人報名不代表逐位學員名冊。正式已繳費與測試名單分開查看；已取消訂單不列入。'));
  const controls=node('div');controls.className='ops-actions';const mode=node('select');mode.setAttribute('aria-label','付款名單類型');for(const [value,label]of [['formal','正式已繳費'],['test','測試付款名單']]){const o=node('option',label);o.value=value;mode.append(o)}
  const search=node('input');search.type='search';search.placeholder='搜尋姓名、手機、課程或活動';search.setAttribute('aria-label','搜尋報名名單');const download=node('button','匯出 CSV'),refresh=node('button','重新整理名單');download.type=refresh.type='button';download.disabled=true;
  controls.append(mode,search,refresh,download);const status=node('p'),summary=node('p'),body=node('div');body.className='ops-table';p.append(controls,status,summary,body);host.append(p);let all=[],visible=[],loading=0;
  function draw(){const q=search.value.trim().toLocaleLowerCase();visible=all.filter(r=>[r.name,r.memberName,r.email,r.phone,r.bike,r.productName,r.category,r.orderId].some(v=>String(v||'').toLocaleLowerCase().includes(q)));body.replaceChildren();summary.textContent=visible.length+' 筆報名 · 共 '+visible.reduce((n,r)=>n+Number(r.quantity||0),0)+' 人 · '+new Set(visible.map(r=>r.memberId)).size+' 位會員';download.disabled=!visible.length;
   if(!visible.length){body.append(node('p',mode.value==='test'?'目前沒有已完成測試付款的報名紀錄。':'目前沒有正式已繳費的報名紀錄。'));return}
   const table=node('table'),thead=node('thead'),head=node('tr');for(const[,label]of columns){const th=node('th',label);th.scope='col';head.append(th)}thead.append(head);const tbody=node('tbody');for(const r of visible){const tr=node('tr');for(const[key]of columns)tr.append(node('td',cell(r,key)));tbody.append(tr)}table.append(thead,tbody);body.append(table);
  }
  async function load(){const id=++loading;all=[];draw();download.disabled=true;status.textContent='正在讀取報名紀錄…';refresh.disabled=true;try{const result=await WildRideMember.request('admin/registrations',{kind,test:mode.value==='test'});if(serial!==active||id!==loading)return;all=result.rows;status.textContent=mode.value==='test'?'測試付款資料，不代表正式繳費或報名。舊訂單未填寫的欄位標示為「資料待補」。':'只列出已確認的正式付款；測試交易不會列入。';draw()}catch(e){if(serial===active&&id===loading)status.textContent=e.message}finally{if(id===loading)refresh.disabled=false}}
  mode.onchange=load;refresh.onclick=load;search.oninput=draw;download.onclick=()=>exportCsv(visible,kind,mode.value==='test');await load();
 }
 return{render,csvCell};
})();
