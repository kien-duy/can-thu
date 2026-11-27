# Cần Thủ

Game câu đài 3D trên web cho người vừa làm việc vừa muốn câu. Bạn thả câu rồi quay lại làm việc; khi cá bắt đầu rỉa mồi, game báo cho bạn quay lại.

Trạng thái: **M3**. Có 3 nơi câu: Hồ Đồng Xanh (hồ dịch vụ, vé theo giờ thật), Bến sông làng (mở ở cấp 2) và Hồ núi Mây (mở ở cấp 4). Sông và hồ núi câu tự do, cá bán cho lái cá với giá thấp hơn. 15 loài cá có đặc tính đời thật. Mồi rã dần trong nước; có thể xả mồi mở ổ để gom cá. Cảnh 3D low-poly riêng cho từng nơi: nước dùng shader, trời và trăng sao theo giờ thật, camera tự lại gần phao khi cá rỉa, có góc rộng toàn cảnh. 10 loài sinh vật ghé bờ nước theo địa điểm, giờ và thời tiết. Sổ tay gồm các loài, nhật ký câu, kho nhịp phao để tập giật, và sinh vật đã gặp. Có nhiệm vụ ngày, chế độ nhìn xuyên nước, cài đặt chất lượng đồ hoạ, cỡ khung phao và âm thanh.

Mồi, độ sâu, kiểu cân, nhiệt độ nước, giờ trong ngày, dây và phao đều ảnh hưởng loài nào cắn, bao lâu cá tới và phao báo to hay nhỏ (`src/sim/setup.ts`).

- `?fast=1`: thu nhỏ thời gian chờ, và 1 "giờ" vé = 60 giây, để thử nhanh.
- `?seed=123`: lượt câu tái hiện được.
- `?store=local`: lưu trên trình duyệt, không gọi server.

## Chạy trên máy

Cần Node 22 (`.nvmrc`).

```bash
npm install
npm run dev          # http://localhost:5173 (game + API trên cùng một cổng)
npm run check        # typecheck + lint + unit test + build + e2e: chạy trước mỗi lần push
```

Không cần cài Postgres hay Docker. `npm run dev` gắn API (`server/app.ts`) vào Vite dev server, và DB là **PGlite** (Postgres biên dịch sang WASM, chạy ngay trong Node), dữ liệu nằm ở `.data/pglite`. Xoá thư mục đó là về DB trống. `PGLITE_DIR=memory` giữ DB trong bộ nhớ.

- Mở game là có ngay tài khoản khách trên server (cookie phiên). Bảng Tài khoản cho tạo tài khoản bằng email + mật khẩu (giữ nguyên mọi thứ đã câu), đăng nhập ở máy khác, đăng xuất, xoá tài khoản.
- Mất mạng: ca câu và cá nằm trong hàng đợi trên máy, có mạng lại thì tự gửi.
- Bản production chạy thử trên máy: `npm run build && npm start` (http://localhost:8787).
- Trang đo báo động: `/spike.html`. Bấm "Đo đầy đủ", chuyển sang ứng dụng khác, đợi 10 phút, rồi quay lại bấm "Chép kết quả JSON".
- Đổi schema (`server/db/schema.ts`) thì chạy `npm run db:generate` để sinh migration mới trong `drizzle/`. Server tự chạy migration khi khởi động.

## Server và DB

Giống caro-clone: một server Node (Hono) phục vụ cả API dưới `/api` lẫn bản build trong `dist/`. DB truy cập qua Drizzle.

| biến môi trường | nghĩa |
| --- | --- |
| `DATABASE_URL` | Postgres khi lên mạng (Neon). Bỏ trống: PGlite trong `.data/pglite` |
| `DATABASE_URL_UNPOOLED` | Neon: URL không qua pooler, dùng để chạy migration |
| `REQUIRE_DATABASE_URL` | đặt trên host xoá đĩa khi khởi động lại (gói miễn phí Render): thiếu `DATABASE_URL` thì không chạy |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | bật nút "Liên kết Google". OAuth client loại "Web application", redirect URI `<site>/api/auth/google/callback` |
| `PUBLIC_URL` | địa chỉ công khai của site khi đứng sau proxy |
| `PORT`, `HOST` | mặc định 8787, 0.0.0.0 |

Quy tắc chống gian lận thô nằm trong `server/game.ts`: cân nặng trong giới hạn của loài, loài có ở hồ đó, cá nằm trong giờ ca, tối đa 6 con mỗi phút, ca vé tối đa 8 tiếng. Server đọc chính `content/*.json` để kiểm tra.

## Cấu trúc

| thư mục | nội dung |
| --- | --- |
| `content/` | dữ liệu game: loài, địa điểm, mồi, đồ nghề, kiểu cân, sinh vật, nhiệm vụ (kiểm tra bằng zod) |
| `src/sim/` | lõi mô phỏng, TypeScript thuần, tất định: phao, cá cắn, kéo cá, đồng hồ, thời tiết |
| `src/data/` | `GameRepository`: bản gọi server, bản lưu trên máy, hàng đợi offline |
| `src/game/` | tiến độ người chơi (xu, xp, túi đồ, mồi) dạng hàm thuần; store Zustand |
| `src/ui/` | cảnh 3D (React Three Fiber), khung phao SVG, HUD, khay chuẩn bị, cửa hàng, ca câu, sổ tay, tài khoản |
| `src/alerts/` | báo động khi tab ẩn (timer trong worker) |
| `src/spike/` | spike M0: worker + đo độ trễ báo động |
| `server/` | API (Hono), phiên đăng nhập, quy tắc ghi cá, schema Drizzle, kết nối PGlite/Postgres |
| `drizzle/` | migration SQL sinh từ `server/db/schema.ts` |
| `replica/` | tài liệu thiết kế: recon, kiến trúc, nhận diện, bảng tính năng. Ảnh trong `replica/screens/` chỉ để tham khảo, không đưa vào game |
| `tests/e2e/` | Playwright |

Kiến trúc: [`replica/architecture.md`](replica/architecture.md).

## Deploy

Cần một host chạy Node (vì có server), ví dụ Render như caro-clone: build `npm ci && npm run build`, start `npm start`, health check `/healthz`, đặt `DATABASE_URL` (Neon) và `REQUIRE_DATABASE_URL=1`. Chưa deploy lần nào.

Sau này chuyển sang Cloudflare: app Hono chạy được trên Workers, DB nối Neon qua Hyperdrive. Phần cần sửa: `server/index.ts` (thay bằng entry của Worker, phục vụ `dist` bằng Workers Assets) và kiểm tra `node:crypto` (scrypt) với cờ `nodejs_compat`.

## Bản quyền

© 2026 chủ dự án. Mọi quyền được bảo lưu; repo này để public nhưng **chưa cấp giấy phép mã nguồn mở**. Tài nguyên bên thứ ba được ghi trong [`ASSETS.md`](ASSETS.md).

Đây là game độc lập, không liên quan tới game câu cá nào khác. Cơ chế câu đài thuộc về thể loại; tên, hình ảnh, chữ và mã nguồn đều được viết mới.
