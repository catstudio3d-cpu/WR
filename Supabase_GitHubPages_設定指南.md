# 馭野網站：GitHub Pages ＋ Supabase 設定指南

正式網址：https://catstudio3d-cpu.github.io/WR/
Supabase 專案：https://fyqlfldjoaikmxowmrfi.supabase.co

目前程式已備妥，尚未替你執行雲端 migration、啟用 Google Provider 或推送 GitHub。
唯讀檢查結果：Email 登入已啟用；Google 登入未啟用；academy_request RPC 尚未建立。

## 1. 建立學院資料表

在 Supabase Dashboard → SQL Editor，依序開啟、執行：

1. `supabase/migrations/202611180001_academy.sql`
2. `supabase/migrations/202611180002_catalog.sql`

第一份建立會員資料、管理角色、技能進度、商品、購物車、訂單、評量、證書及操作紀錄；開啟 RLS，會員只能讀寫自己的資料，管理者操作由資料庫檢查權限。
第二份加入目前 16 件 NT$0 示意商品，重新執行不會覆寫已有商品。
大頭照使用 private 的 `avatars` Storage bucket，只允許本人存取自己的 `會員 UUID/avatar.jpg`。
SQL 已在本機 PostgreSQL 相容測試環境驗證，包括跨會員隔離、偽造管理者、庫存、訂單重送及證書核發／撤銷。

## 2. Supabase Auth 網址

Authentication → URL Configuration：

| 欄位 | 值 |
|---|---|
| Site URL | `https://catstudio3d-cpu.github.io/WR/` |
| Redirect URLs | `https://catstudio3d-cpu.github.io/WR/member.html` |

Email 驗證回跳及 Google 登入回跳都使用 member.html。
Authentication → Providers → Email：建議啟用 Confirm email。正式大量寄信時另設定自己的 SMTP；不需把 SMTP 密碼交給前端。
註冊使用 `supabase.auth.signUp`；需要驗證時顯示查看信件提示，完成驗證後才登入會員。
密碼登入使用 `supabase.auth.signInWithPassword`。

## 3. 建立 Google 帳號登入

進入 Google Cloud Console → Google Auth Platform：設定 Branding、Audience、Data Access（基本 openid/email/profile），建立 OAuth Client，類型選 **Web application**。

| Google OAuth 欄位 | 值 |
|---|---|
| Authorized JavaScript origins | `https://catstudio3d-cpu.github.io` |
| Authorized redirect URIs | `https://fyqlfldjoaikmxowmrfi.supabase.co/auth/v1/callback` |

注意：Google 的 callback 是 Supabase URL，不是 GitHub 的 member.html。
Google 驗證 → Supabase callback → GitHub Pages member.html，是三段不同的網址。

在 Supabase → Authentication → Providers → Google：

1. 啟用 Google Provider。
2. 貼入 Google OAuth Client ID 及 Client Secret，儲存。
3. Google OAuth 若為 Testing，將實際測試 Google 帳號加入 Test users；正式開放前依 Google 要求完成發布／驗證。

網頁按鈕使用 `signInWithOAuth({ provider: 'google', options: { redirectTo: 'https://catstudio3d-cpu.github.io/WR/member.html' } })`。
前端使用 PKCE，由 Supabase SDK 處理登入回跳、工作階段持久保存及更新；請從同一瀏覽器完成驗證。

**Client Secret、service_role／secret key 只能留在 Supabase，不要放進 GitHub、HTML 或回覆訊息。前端現有 publishable key 可公開，資料保護由 RLS 與登入身分負責。**

## 4. 建立管理者

本機 SQLite 的帳密與會員 UUID 不會自動轉到 Supabase。請先在新網站註冊／Google 登入，確認本人身分，再在 SQL Editor 執行下列操作。
此例只指定既有管理者 Email，不會設定密碼，也不會從使用者可編輯的 metadata 授予管理權限：

```sql
insert into public.user_roles(user_id, role)
select id, 'admin' from auth.users
where lower(email) = 'catstudio3d@gmail.com'
  and email_confirmed_at is not null
on conflict (user_id) do update set role = excluded.role;
```

執行結果應為 1 筆；若為 0 筆，請先完成註冊及 Email 驗證。重新登入後再進入 admin.html。
禁止在前端判斷「Email 相同就當管理者」。

## 5. 部署管理者重設密碼 Edge Function

GitHub Pages 無法安全持有管理密鑰，這項功能需另外部署到 Supabase。
檔案：`supabase/functions/admin-member-password/index.ts`

已登入 Supabase CLI 後，在專案資料夾執行：

```text
supabase functions deploy admin-member-password --project-ref fyqlfldjoaikmxowmrfi --no-verify-jwt
```

`--no-verify-jwt` 是關閉入口的舊式 JWT 檢查；Function 本身仍會透過 Auth getUser 驗證 Bearer JWT，再查詢資料庫確認 admin 角色。匿名或一般會員都會被拒絕。
`SUPABASE_SERVICE_ROLE_KEY` 使用 Function 的伺服端環境值，前端不需要也不應知道。
允許網站 Origin 預設為 `https://catstudio3d-cpu.github.io`。若要增加測試網站，在 Function Secrets 設定 `ALLOWED_ORIGINS`（逗號分隔）。
雲端重設密碼後，尚未到期的 access JWT 可能仍有效，不能宣稱與本機版一樣立即終止所有請求。

## 6. 發布 GitHub Pages

專案已提供 `.github/workflows/pages.yml`：只發布 `dist/`，不公開本機資料庫。
將專案原始碼放入 WR 儲存庫，workflow 必須位於 **儲存庫根目錄** 的 `.github/workflows/pages.yml`。
GitHub → WR → Settings → Pages → Build and deployment → Source 選 **GitHub Actions**。
推送 main 後，由 Action 發佈。若預設分支不是 main，修改 workflow 的 branches。

若採手動上傳靜態成品，則把 `dist/` 裡面的檔案直接放在發布目錄根部，讓 `/WR/index.html`、`/WR/member.html` 等路徑存在。
所有內部資源使用相對路徑，支援 `/WR/` 子目錄。證書使用 certificate.html，登入後確認有效紀錄再列印／另存 PDF。

## 7. 本機與雲端測試

`dist/supabase-config.js` 已填入本次 project URL、publishable key 與 GitHub Pages 網址。
目前 `localPreview: true`，在 127.0.0.1／localhost 保留原有 Python/SQLite 預覽；正式 GitHub Pages 一律使用 Supabase。
若要在本機連 Supabase，將 localPreview 改為 false，使用一般靜態伺服器，並在 Supabase Redirect URLs 加入本機 member.html 完整網址。Google OAuth 的正式 redirectTo 仍指向已設定的 GitHub 網址。
原 Python 預覽服務帶有僅允許本站的 CSP；雲端測試請使用一般靜態伺服器，或直接到 GitHub Pages 測試。

建議驗收：Email 註冊→驗證信→密碼登入；Google 登入→返回 member.html；更新個人資料→重整；技能筆記→另一頁讀取；不同會員互相不可查看；購物車→詢價單→後台處理；評量→手動核發→會員列印；撤銷後不可重新列印。

## 還需要你完成／提供的資訊

- GitHub Pages URL 已提供並填入，無須再提供 GitHub 密碼。
- Google OAuth Web Client ID；Client Secret 請自行填入 Supabase。
- 回覆是否已完成 Google Provider 啟用、兩份 SQL 執行、Edge Function 部署。
- 若需要我代為推送 GitHub，需提供可用的儲存庫連線／授權，而不是把 GitHub token 貼到公開程式碼。

參考官方文件：
- https://supabase.com/docs/guides/auth/social-sign-in/auth-google
- https://supabase.com/docs/guides/auth/redirect-urls
- https://supabase.com/docs/reference/javascript/auth-signup
- https://supabase.com/docs/reference/javascript/auth-signinwithpassword
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/auth/signout
- https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
