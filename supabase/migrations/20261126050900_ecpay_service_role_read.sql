-- 既有會員 migration 曾撤銷 service_role 的資料表讀取權；僅補回付款後端檢查角色所需的 SELECT。
grant select on public.user_roles to service_role;
