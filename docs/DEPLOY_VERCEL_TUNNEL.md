# 🚀 Deploy Frontend lên Vercel + Backend qua Cloudflare Quick Tunnel

Mục tiêu: **mỗi lần chạy lại quick tunnel (URL đổi) chỉ phải sửa CONFIG (Vercel env / query `?api=` / Firebase authorized domain), không phải sửa code hay sửa CORS.**

---

## 1. Vì sao không cần sửa code khi đổi tunnel

Cơ chế đã được làm sẵn (một lần, trong repo):

| Thành phần | Cơ chế | File |
| :--- | :--- | :--- |
| Base URL backend | Resolve lúc **runtime**, không hardcode trong code | `clients/src/api/apiBase.ts` |
| Token (Firebase / dev) | Một chỗ duy nhất, trả `null` khi chưa có → không gửi header rác | `clients/src/auth/accessToken.ts` |
| Dev JWT | Bật/tắt bằng env, secret đọc từ config | `clients/src/auth/devAuth.ts`, `building-block/Sudoku.Auth/AuthExtensions.cs` |
| CORS | Envoy cho phép **mọi origin** + echo origin (đã test preflight) | `gateway/envoy.yaml` |

**Thứ tự resolve base URL** (`apiBase.ts`) — cái nào có trước thì dùng:

1. `?api=https://xxx.trycloudflare.com` trên URL → đồng thời lưu `localStorage` (`?api=reset` để xoá)
2. `localStorage["prnasm.apiBase"]`
3. `<meta name="api-base" content="...">` trong `clients/index.html`
4. `VITE_API_URL` (env lúc build — Vercel/CI/docker)
5. Rỗng = same-origin (khi web + nginx proxy cùng host)

⇒ Đổi tunnel **không cần build lại** nếu dùng cách (1). Nếu muốn cố định thì dùng cách (2)/(4) — cả hai đều là config.

---

## 2. Mỗi lần demo: 4 bước

### Bước 1 — Bật backend

```powershell
cd D:\GitHub\PRN_ASM
pwsh -File deploy/start-be.ps1          # lần đầu / sau khi sửa code: có --build
pwsh -File deploy/start-be.ps1 -NoBuild # khởi động nhanh với image sẵn có
```

Kết quả mong đợi: 9 container `Up`, in ra `http://localhost:5173` và `http://localhost:18080`.

### Bước 2 — Mở quick tunnel

```powershell
pwsh -File deploy/quick-tunnel.ps1      # tunnel vào web :5173 (UI + proxy API)
# hoặc: pwsh -File deploy/quick-tunnel.ps1 -Port 18080   # chỉ public API Gateway
```

Copy dòng `https://<random-words>.trycloudflare.com`.

### Bước 3 — Trỏ frontend Vercel vào tunnel (chọn 1)

**Cách A — không deploy lại (nhanh nhất, khuyến nghị khi demo):**

```
https://<vercel-app>.vercel.app/?api=https://<tunnel>.trycloudflare.com
```

URL được ghi vào `localStorage`, các lần sau mở link gốc vẫn dùng tunnel đó.
Xoá override: `https://<vercel-app>.vercel.app/?api=reset`

**Cách B — cấu hình trong Vercel (deploy lại 1 click):**

Vercel → Project → **Settings → Environment Variables**:

| Biến | Giá trị |
| :--- | :--- |
| `VITE_API_URL` | `https://<tunnel>.trycloudflare.com` |
| `VITE_DEV_AUTH_SECRET` | `<secret >= 32 ký tự, trùng DEV_AUTH_SECRET của backend>` |
| `VITE_FIREBASE_API_KEY` / `VITE_FIREBASE_AUTH_DOMAIN` / `VITE_FIREBASE_PROJECT_ID` / `VITE_FIREBASE_APP_ID` | giữ nguyên như `clients/.env` |

Rồi **Deployments → …  → Redeploy** (Vite inline env lúc build nên phải redeploy).

**Cách C — pin trong HTML (không khuyến nghị, bẩn git):** điền URL vào
`<meta name="api-base" content="...">` trong `clients/index.html`.

### Bước 4 — Firebase: thêm domain được phép đăng nhập

Firebase Console → **Authentication → Settings → Authorized domains** → thêm:

- `<vercel-app>.vercel.app`
- host của tunnel, dạng `<random-words>.trycloudflare.com` (đổi mỗi lần chạy)

Thiếu bước này ⇒ đăng nhập Google/Email báo `auth/unauthorized-domain`.
Quick tunnel không cần khai báo gì thêm ở Cloudflare (không có account).

---

## 3. Vì sao CORS không cần sửa

`gateway/envoy.yaml` cấu hình:

```yaml
allow_origin_string_match:
  - safe_regex:
      regex: ".*"
allow_credentials: true
```

Envoy trả `Access-Control-Allow-Origin: <origin gọi tới>` cho **mọi** origin. Đã test thật
(preflight từ `https://prn-asm-demo.vercel.app`):

| Endpoint | Kết quả |
| :--- | :--- |
| `OPTIONS /sudoku.game.v1.GameService/StartGame` | `200` + `ACAO: https://prn-asm-demo.vercel.app` |
| `OPTIONS /api/v1/notices` | `200` + ACAO đúng |
| `OPTIONS /hubs/match/negotiate` | `200` + ACAO đúng |

Muốn siết bảo mật sau này: **chỉ sửa 1 file** `gateway/envoy.yaml` (whitelist domain),
không phải sửa CORS trong từng service.

---

## 4. Env map (ai đọc biến nào)

| Nơi khai báo | Biến | Dùng bởi | Ghi chú |
| :--- | :--- | :--- | :--- |
| `deploy/.env` | `GATEWAY_PORT`, `WEB_PORT`, `POSTGRES_*`, `FIREBASE_PROJECT_ID`, `ALLOW_DEV_TOKENS`, `DEV_AUTH_SECRET` | `docker compose` | **gitignored** — copy từ `deploy/.env.example` |
| `deploy/docker-compose.yml` | `Auth__AllowDevTokens`, `Auth__DevSecret` | 4 service .NET | dev token chỉ hoạt động khi `=true` |
| `clients/Dockerfile` (build args) | `VITE_API_URL`, `VITE_DEV_AUTH_SECRET` | image web | compose truyền từ `DEV_AUTH_SECRET` |
| Vercel env | `VITE_API_URL`, `VITE_DEV_AUTH_SECRET`, `VITE_FIREBASE_*` | FE production | phải **Redeploy** sau khi đổi |
| `services/*/appsettings.json` | `Auth:AllowDevTokens`, `Auth:DevSecret`, `ConnectionStrings:Default`, `Kafka:BootstrapServers`, `Services:*` | chạy `dotnet run` | copy từ `appsettings.example.json` |

⚠️ `VITE_DEV_AUTH_SECRET` (FE) phải **trùng** `DEV_AUTH_SECRET` (backend). Không set ở Vercel ⇒
FE không gửi dev token ⇒ khách chưa đăng nhập sẽ nhận `Unauthenticated` ở endpoint cần auth
(đây là hành vi bảo mật đúng, không phải bug).

Bật/tắt dev token:

```powershell
# tắt hoàn toàn dev token (chỉ chấp nhận Firebase ID token thật)
# deploy/.env
ALLOW_DEV_TOKENS=false
```

---

## 5. Checklist lỗi thường gặp

| Triệu chứng | Nguyên nhân | Cách xử lý |
| :--- | :--- | :--- |
| `401 Unauthenticated` toàn bộ | dev token bị tắt, hoặc secret FE ≠ BE | set `VITE_DEV_AUTH_SECRET` = `DEV_AUTH_SECRET`, redeploy FE |
| `auth/unauthorized-domain` | domain chưa khai báo ở Firebase | thêm domain (Bước 4) |
| Trắng trang / mọi request đi `localhost:8080` | `VITE_API_URL` cũ trong bundle + chưa có `?api=` | mở `?api=https://<tunnel>` hoặc Redeploy với env mới |
| API 502/404 qua tunnel | tunnel đã chết (quick tunnel không có SLA) | chạy lại `quick-tunnel.ps1`, cập nhật URL |
| SignalR không kết nối (`/hubs/match`) | URL tunnel cũ, hoặc `?api=` thiếu scheme | dùng `?api=https://...` (phải có `https://`) |
| Websocket bị chặn ở mạng công ty/trường | outbound 7844 bị chặn | dùng mạng khác, hoặc `cloudflared tunnel --protocol http2 --url ...` |

---

## 6. Cấu hình Vercel (một lần)

| Setting | Giá trị |
| :--- | :--- |
| Framework Preset | Vite |
| Root Directory | `clients` |
| Install Command | `npm ci` |
| Build Command | `npm run build` (đã khai báo trong `clients/vercel.json`) |
| Output Directory | `dist` |

`clients/vercel.json` đã có sẵn rewrite SPA (mọi path → `index.html`, vì dùng `BrowserRouter`) và
`framework`/`buildCommand`/`outputDirectory`. Nếu clone chưa có `clients/src/gen` (gen được commit sẵn
nên thường không cần), đổi `buildCommand` thành `npm run gen && npm run build`.

⚠️ Không dùng rewrite để proxy API sang tunnel: Vercel rewrite **không hỗ trợ WebSocket**, sẽ làm
SignalR multiplayer chết. Cứ để FE gọi thẳng tunnel (CORS đã mở) để WebSocket hoạt động.
