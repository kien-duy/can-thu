# Architecture: Cần Thủ (game câu đài 3D, làm lại theo cơ chế thể loại của "Câu Đài Hồ Dịch Vụ")

Date: 2026-11-26. Nguồn: `recon.md`, `features.csv`, `brand.md`, cùng các quyết định đã chốt qua 4 vòng hỏi.

## Nguyên tắc

1. **Game chạy ở client, server chỉ lưu.** Toàn bộ mô phỏng (phao, cá, kéo cá) là TypeScript thuần chạy trong trình duyệt. Server lưu nhật ký câu, tiến độ và chặn vài kiểu gian lận thô.
2. **Mô phỏng tách khỏi phần hiển thị.** Một lõi `sim/` không biết gì về React, Three.js hay DOM. Cảnh 3D, chế độ văn phòng và test đều chỉ đọc trạng thái từ lõi này. Nhờ đó chạy test headless được, và tab ẩn vẫn mô phỏng tiếp.
3. **Mô phỏng tính theo thời điểm, không theo tick.** Mọi sự kiện (cá tới ổ, bắt đầu rỉa, cửa sổ giật, mồi rã) được lên lịch bằng mốc thời gian tuyệt đối từ một RNG có seed. Trình duyệt có bóp timer khi tab ẩn thì kết quả vẫn đúng; chỉ có thông báo là có thể trễ.
4. **Nội dung là dữ liệu.** Loài, nhịp phao, địa điểm, đồ nghề, nguyên liệu, bài mồi, sinh vật, nhiệm vụ: mỗi thứ là một file JSON trong `content/`, được zod kiểm tra lúc build. Mở rộng độ sâu nghĩa là thêm dữ liệu.
5. **Một cửa vào dữ liệu.** Mọi đọc/ghi server đi qua interface `GameRepository` (`src/data/`). Bản đầu có `SupabaseRepository` (dùng supabase-js) và `MemoryRepository` (cho test và chơi offline). Khi chuyển sang Cloudflare chỉ cần viết thêm một implementation.

## Stack

| layer | choice | why |
| --- | --- | --- |
| web | Vite + React 19 + TypeScript (SPA) | chỉ có một màn hình game, không cần SSR; Vite build nhanh, ra file tĩnh deploy thẳng lên Pages |
| 3D | three.js qua React Three Fiber + drei | viết cảnh bằng component React cùng hệ với UI; drei có sẵn Sky, Water, camera controls |
| UI / styling | CSS Modules + CSS custom properties từ `replica/design/tokens.json` | bảng UI ít, không cần Tailwind; token sáng/tối dùng chung cho UI và chế độ văn phòng |
| state | Zustand (UI) + lõi `sim/` thuần TS | Zustand đọc được từ cả cây React lẫn vòng render R3F mà không re-render thừa |
| kiểm tra dữ liệu | zod | dùng chung cho content JSON, jsonb `player_state.state` và payload RPC |
| database | Postgres trên Supabase | dữ liệu sổ tay có dạng quan hệ; có RLS, RPC và gói miễn phí |
| auth | Supabase Auth: khách ẩn danh → liên kết Google hoặc email | chơi ngay không cần đăng ký mà dữ liệu vẫn lên server ([anonymous sign-ins](https://supabase.com/docs/guides/auth/auth-anonymous)) |
| offline | IndexedDB (thư viện `idb`) làm hàng đợi ghi | cá câu lúc mất mạng được giữ lại, gửi lại khi có mạng; id do client sinh nên gửi trùng cũng an toàn |
| payments / email | không có | không nạp tiền thật; email đăng nhập do Supabase gửi |
| jobs | pg_cron trong Supabase | một job dọn tài khoản khách bỏ hoang (bên dưới) |
| test | Vitest (sim, repository, content), Playwright (luồng chơi), `replica/db-test/run.sh` (schema) | lõi sim tất định nên test được mọi nhịp phao không cần trình duyệt |
| hosting | Cloudflare Pages, Git integration | miễn phí, tự build khi push; có preview cho mỗi PR |
| CI | GitHub Actions (repo public nên miễn phí): typecheck, Vitest, Playwright, test schema | chạy local trước khi push |

## Cấu trúc thư mục dự kiến

```
content/            species.json, bite-patterns.json, locations.json, gear.json, ingredients.json,
                    recipes.json, creatures.json, quests.json        (+ zod schema trong src/content/)
src/sim/            clock (giờ thật), weather, rng, rig, bait, fish-ai, bite-scheduler, float-physics,
                    fight, session  — TS thuần, không import React/three
src/sim/worker.ts   chạy sim trong Dedicated Worker; giữ lịch sự kiện, bắn báo động
src/alerts/         Notification API, đổi tiêu đề tab/favicon, âm thanh (Web Audio)
src/data/           GameRepository + SupabaseRepository + MemoryRepository + hàng đợi offline
src/scene/          R3F: Pond, Water, Sky, Float, Rod, Line, Wildlife, CameraRig
src/office/         chế độ văn phòng: cận cảnh phao bằng SVG/canvas 2D, không dùng WebGL
src/ui/             HUD, khay chuẩn bị (cân phao, mồi, đồ nghề), sổ tay, cửa hàng, cài đặt
supabase/migrations/0001_init.sql
scripts/seed-reference.ts           đẩy species/locations từ content/ vào DB
```

## Mô phỏng khi tab ẩn: luồng chạy

```
main thread                         Dedicated Worker (sim)
-----------                         ----------------------
quăng ──── postMessage(cast) ─────▶ lên lịch: cá tới ổ (t1), rỉa (t2..t3), cửa sổ giật (t4..t4+w)
                                    setTimeout tới mốc gần nhất
                                    t2: postMessage(nibble) ──▶ main: âm thanh khẽ, tiêu đề tab "• Phao động"
                                        + new Notification() nếu tab ẩn và người chơi đã cho phép
tab hiện lại ── visibilitychange ──▶ worker gửi snapshot → cảnh 3D / chế độ văn phòng vẽ đúng trạng thái
click Giật ─── postMessage(strike, t) ▶ so t với cửa sổ giật → hooked | missed_early | missed_late
```

- Cửa sổ rỉa dài 10–40 s, cửa sổ giật khoảng 1 s (đã chốt). Người chơi quay lại trong lúc cá đang rỉa, mắt đã ở trên phao trước khi tới cửa sổ giật.
- Chỉ bắn thông báo khi `document.hidden`. Xin quyền thông báo sau con cá đầu tiên, không xin lúc mở game.
- Cảnh 3D chuyển `frameloop="never"` khi tab ẩn và `"demand"` ở chế độ văn phòng: không tốn GPU khi không ai nhìn.

## Schema

Tables: 8 (+ 1 view). Access rules: **Postgres RLS**. Client chỉ được `select` dữ liệu của chính mình. Mọi lệnh ghi đi qua 6 hàm RPC `security definer`, các hàm này tự kiểm tra `auth.uid()`.

| bảng | vai trò |
| --- | --- |
| `species`, `locations`, `location_species` | dữ liệu tham chiếu, seed từ `content/`, ai cũng đọc được |
| `profiles` | tên hiển thị, múi giờ, cài đặt |
| `player_state` | xu, xp, và jsonb túi đồ/rig/mồi/nhiệm vụ, có `version` để chống ghi đè giữa hai máy |
| `fishing_sessions` | ca câu; mỗi người tối đa 1 ca mở (unique index có điều kiện) |
| `catches` | từng con cá: loài, cân (gam), giờ, giờ địa phương, thời tiết, nhiệt độ nước, độ sâu, mồi, rig, số phận |
| `wildlife_sightings` | sinh vật đã gặp |
| view `handbook_entries` | tổng hợp sổ tay theo loài: số con, kỷ lục, lần đầu, các địa điểm, giờ hay câu được |

Toàn bộ SQL nằm trong [`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql). Đã chạy trên Postgres 16 với stub auth của Supabase; bộ test [`db-test/`](db-test/) đạt hết: ghi cá hợp lệ, gửi trùng, cân nặng sai, loài không có ở địa điểm, câu ngoài giờ ca, insert trực tiếp bị chặn, giới hạn 6 con/phút, xung đột version, người khác không đọc được dữ liệu, khách chưa đăng nhập không gọi được RPC.

## API

Không có server riêng. "API" gồm các RPC Postgres và lệnh select qua supabase-js, tất cả gói trong `GameRepository`.

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| `auth.signInAnonymously()` | tạo khách; trigger tạo `profiles` + `player_state` | ai cũng gọi được | — | session JWT | F01 |
| `auth.linkIdentity({provider:'google'})` / `auth.updateUser({email})` | biến khách thành tài khoản thật, giữ nguyên user_id | authenticated | — | — | liên kết |
| `select profiles, player_state` | tải tiến độ lúc mở game | chủ sở hữu | — | 1 dòng mỗi bảng | mở game |
| `rpc save_player_state` | lưu xu, xp, túi đồ; trả `-1` nếu version cũ | chủ sở hữu | expected_version, coins, xp, state, schema | version mới / -1 | sau mỗi thay đổi (debounce 5 s) và khi ẩn tab |
| `update profiles` | đổi tên, múi giờ, cài đặt | chủ sở hữu (RLS) | fields | — | cài đặt |
| `rpc start_session` | mở ca; tự đóng ca cũ còn treo thành `abandoned` | chủ sở hữu | id, location, kind, vé, giờ bắt đầu/kết thúc, thời tiết | session | F02 |
| `rpc record_catch` | ghi một con cá sau khi kiểm tra | chủ sở hữu | jsonb catch | catch | F04 |
| `rpc set_catch_fate` | đổi số phận: giữ / thả / bán | chủ sở hữu | id, fate | — | F05 |
| `rpc end_session` | đóng ca, ghi tiền kiếm được | chủ sở hữu | id, ended_at, outcome, coins | session | F05 |
| `rpc record_sighting` | ghi sinh vật đã gặp | chủ sở hữu | creature, location, time | — | động vật ghé qua |
| `select handbook_entries` / `catches` | sổ tay: tổng hợp theo loài, nhật ký có phân trang | chủ sở hữu | species?, cursor | rows | sổ tay |
| `select species, locations, location_species` | kiểm tra content khớp DB (rev) | ai cũng đọc được | — | rows | mở game |

Webhooks in: không có. Webhooks out: không có.

Jobs:
- `cleanup-abandoned-guests`, pg_cron hằng ngày lúc 03:00 UTC: xoá user ẩn danh không hoạt động quá 90 ngày (`auth.users.is_anonymous` và `last_sign_in_at`). Dữ liệu của họ tự xoá theo `on delete cascade`.
- Không cần job cho ca câu: ca hết giờ được đóng lúc người chơi quay lại, hoặc khi mở ca mới.

Chỉ dùng API chính thức với key của chính dự án. Không dùng endpoint nào của bản tham khảo.

## The parts that bite

- **Bóp timer khi tab ẩn:** Chrome bóp timer của main thread (1 lần/giây, và có thể 1 lần/phút sau 5 phút ẩn); Safari còn mạnh tay hơn. Vì vậy sim chạy trong Dedicated Worker và tính theo thời điểm. **Chưa kiểm chứng** worker có tránh được việc bóp này trên Chrome, Edge, Firefox, Safari hay không, cũng như `new Notification()` từ worker có chạy trên Safari không. Đây là milestone M0, phải làm trước tiên. Nếu Safari không đạt: phương án dự phòng là báo bằng tiêu đề tab và âm thanh, đồng thời kéo dài cửa sổ rỉa.
- **Âm thanh khi tab ẩn:** trình duyệt chặn tự phát âm thanh. Phải `resume()` AudioContext trong cú click "Quăng" đầu tiên thì về sau mới phát được khi tab ẩn. Cũng kiểm tra trong M0.
- **Múi giờ và giờ thật:** đồng hồ game lấy giờ máy theo `profiles.tz` (mặc định Asia/Ho_Chi_Minh, Việt Nam không có giờ mùa hè). Lưu `caught_at` theo UTC và `local_hour` riêng để thống kê "giờ ăn" không phụ thuộc múi giờ. Đồng hồ máy bị chỉnh sai thì server kiểm tra lệch tối đa 2 phút so với `now()`.
- **Idempotency:** id session và catch do client sinh; RPC trả lại bản đã có khi gửi trùng. Hàng đợi offline gửi lại bao nhiêu lần cũng được.
- **Hai máy cùng chơi:** `player_state.version` chống ghi đè. Gặp `-1` thì tải bản server, gộp theo quy tắc: xu và xp lấy bản mới nhất, túi đồ lấy hợp của hai bên. Ca câu: unique index chỉ cho mở 1 ca, ca mở sau tự đóng ca cũ.
- **Gian lận:** client có thể bịa `caught_at` hoặc gọi RPC bằng tay. Bản đầu chấp nhận rủi ro này vì chưa có bảng xếp hạng (đã chốt). Server chỉ chặn cân nặng ngoài khoảng, loài sai địa điểm, câu ngoài giờ ca và hơn 6 con/phút. Khi có bảng xếp hạng thì chuyển phần quyết định kết quả lên server.
- **Lệch content giữa client và DB:** `species.content_rev`; script seed chạy trong lúc deploy. Client mới mà DB cũ thì `record_catch` báo `unknown_species`: cá được giữ lại trong hàng đợi và báo lỗi nhẹ.
- **Hiệu năng 3D:** mục tiêu 30 fps trên GPU tích hợp. Ngân sách khoảng 150k tam giác, 1 đèn có bóng, shader nước đơn giản. Có cài đặt Thấp/Vừa/Cao và `frameloop` theo trạng thái.
- **Rate limit Supabase:** ghi gom (debounce 5 s cho `save_player_state`), mỗi con cá là 1 RPC. Gói miễn phí dư sức ở quy mô này.
- **Xoá dữ liệu cá nhân:** xoá user là xoá sạch nhờ `on delete cascade`. Cần thêm nút "Xoá tài khoản" (gọi Edge Function bằng service role) ở milestone M2.
- **Chuyển sang Cloudflare:** (a) Hyperdrive: viết một Worker `/api/*` xác thực JWT của Supabase, gọi đúng các hàm RPC này qua Hyperdrive; client chỉ đổi `GameRepository`. (b) D1: phải viết lại RLS thành kiểm tra trong Worker, chuyển SQL sang SQLite (bỏ jsonb và các RPC plpgsql), và thay Supabase Auth. Phương án (a) rẻ hơn nhiều; schema hiện tại không khoá đường nào.
- **Đăng nhập khách:** phải bật Anonymous sign-ins, Manual linking và CAPTCHA (Turnstile, cũng của Cloudflare) trong cài đặt Supabase để tránh bị spam tạo khách.

## Build order

Mỗi milestone đều chạy được và có test headless.

**M0. Spike nền tảng (1–2 ngày, làm trước mọi thứ).** Trang thử: worker lên lịch sự kiện sau 30 s, 2 phút và 10 phút khi tab ẩn → đo độ trễ của Notification, đổi tiêu đề và âm thanh trên Chrome, Edge, Firefox, Safari. Kết quả quyết định độ dài cửa sổ rỉa. Đồng thời dựng repo: Vite, TS, lint, Vitest, Playwright, CI, deploy rỗng lên Cloudflare Pages.

**M1. Vertical slice: "câu được con rô phi đầu tiên và thấy nó trong sổ tay".**
- Màn: S04 (cảnh 3D dựng thô: mặt nước phẳng, khối bờ, phao trụ), S06 (gợi ý trong lúc chơi), S07, S08 (kéo cá bản đơn giản), S11 (sổ tay tối giản).
- Sim: clock, rng, bite-scheduler, 1 nhịp nhử + 1 nhịp ăn cho 3 loài, strike, fight (ghì / tay mềm).
- Data: khách ẩn danh, `start_session`, `record_catch`, `handbook_entries`; 1 địa điểm.
- Báo động: tiêu đề tab + âm thanh khi tab ẩn.
- Done: Playwright chơi từ lúc mở game tới lúc có 1 dòng trong sổ tay; dòng đó nằm trong DB.

**M2. Must-haves** (tất cả dòng `must` trong `features.csv`):
- Khay chuẩn bị: cân phao (S09, theo nấc, 4 kiểu cân làm sẵn, dò đáy), trộn mồi (S10, 8 nguyên liệu, 4 trục, bài gợi ý).
- Đủ khoảng 15 loài với nhịp riêng; thời tiết và nhiệt độ nước ảnh hưởng tới việc cá cắn.
- Ca câu theo giờ thật (S03 rút gọn), rọng (S13), kết thúc ca bán hoặc thả (S24).
- Cửa hàng cơ bản (S15), túi đồ (S14), `save_player_state`, hàng đợi offline.
- Chế độ văn phòng; Notification từ worker; xin quyền sau con cá đầu tiên.
- Liên kết Google/email; nút xoá tài khoản.
- Sổ tay đầy đủ: thẻ loài với đặc tính đời thật, nhật ký, kỷ lục.

**M3. Should-haves:**
- Làm đẹp 3D (low-poly, nước có shader, trời đổi theo giờ thật), camera tự zoom vào phao, góc rộng.
- Địa điểm 2 và 3 (sông quê, hồ núi).
- Động vật ghé qua + "Sinh vật đã gặp".
- Kho nhịp phao xem thử và tập giật (S12), nhìn xuyên nước, mồi xả và ổ, mồi rã.
- Cấp độ và mở khoá, nhiệm vụ ngày, cài đặt chất lượng và cỡ khung phao.

**M4. Could-haves:** thành tích, NPC hàng xóm, mặt cắt 2D, sơ đồ hồ, đi dạo, trang trí, tiếng Anh, PWA, mobile, bảng xếp hạng (kèm chuyển logic lên server).

**Fixes from replica-entrepreneur:** chưa chạy. Bản tham khảo không có kho đánh giá công khai (không có trên store), nên nguồn chính sẽ là bài đăng trong các nhóm câu đài.
