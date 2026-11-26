-- 名單查詢沿用呼叫者的 RLS，並保留函式內管理者檢查。
alter function public.academy_paid_registrations(text,boolean) security invoker;
