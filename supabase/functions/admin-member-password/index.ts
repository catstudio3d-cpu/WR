import { createClient } from 'npm:@supabase/supabase-js@2.119.0';
// Deploy with verify_jwt=false; this function verifies the user's JWT using Auth itself.
const url=Deno.env.get('SUPABASE_URL')!;
const secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!; // Server environment only.
const service=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
const origins=(Deno.env.get('ALLOWED_ORIGINS')||'https://catstudio3d-cpu.github.io').split(',');
Deno.serve(async request=>{
 const origin=request.headers.get('Origin')||'';const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':origins.includes(origin)?origin:'null','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin','Cache-Control':'no-store'};
 const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
 if(!origins.includes(origin))return reply({error:'不允許的網站來源。'},403);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(request.method!=='POST')return reply({error:'不支援的操作。'},405);
 try{
  const token=(request.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
  const {data:auth,error:authError}=await service.auth.getUser(token);
  if(authError||!auth.user)return reply({error:'請重新登入管理者。'},401);
  const {data:role,error:roleError}=await service.from('user_roles').select('role').eq('user_id',auth.user.id).single();
  if(roleError||role?.role!=='admin')return reply({error:'此功能僅供管理者使用。'},403);
  const raw=await request.text();if(raw.length>4096)return reply({error:'資料過大。'},413);
  const body=JSON.parse(raw);
  if(typeof body.userId!=='string'||!/^[0-9a-f-]{36}$/i.test(body.userId)||typeof body.newPassword!=='string'||body.newPassword.length<12||body.newPassword.length>256||body.newPassword!==body.confirmPassword)return reply({error:'請確認會員及兩次新密碼；密碼需為 12–256 個字元。'},400);
  const {data:entry,error:auditError}=await service.from('audit').insert({actor:auth.user.id,action:'member.password_reset.requested',object_id:body.userId}).select('id').single();
  if(auditError)return reply({error:'無法建立操作紀錄，未重設密碼。'},500);
  const {error}=await service.auth.admin.updateUserById(body.userId,{password:body.newPassword});
  await service.from('audit').update({action:error?'member.password_reset.failed':'member.password_reset',detail:''}).eq('id',entry.id);
  if(error)return reply({error:'密碼未更新，請確認會員存在及密碼是否符合 Supabase 政策。'},400);
  return reply({ok:true,requiresLogin:body.userId===auth.user.id});
 }catch{return reply({error:'請求格式不正確或服務暫時無法使用。'},400)}
});
