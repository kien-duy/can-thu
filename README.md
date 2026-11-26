# Cần Thủ

Game câu đài 3D trên web cho người vừa làm việc vừa muốn câu. Bạn thả câu rồi quay lại làm việc; khi cá bắt đầu rỉa mồi, game báo cho bạn quay lại.

Trạng thái: **M3**. Có 3 nơi câu: Hồ Đồng Xanh (hồ dịch vụ, vé theo giờ thật), Bến sông làng (mở ở cấp 2) và Hồ núi Mây (mở ở cấp 4). Sông và hồ núi câu tự do, cá bán cho lái cá với giá thấp hơn. 15 loài cá có đặc tính đời thật. Mồi rã dần trong nước; có thể xả mồi mở ổ để gom cá. Cảnh 3D low-poly riêng cho từng nơi: nước dùng shader, trời và trăng sao theo giờ thật, camera tự lại gần phao khi cá rỉa, có góc rộng toàn cảnh. 10 loài sinh vật ghé bờ nước theo địa điểm, giờ và thời tiết. Sổ tay gồm các loài, nhật ký câu, kho nhịp phao để tập giật, và sinh vật đã gặp. Có nhiệm vụ ngày, chế độ nhìn xuyên nước, cài đặt chất lượng đồ hoạ, cỡ khung phao và âm thanh.

Mồi, độ sâu, kiểu cân, nhiệt độ nước, giờ trong ngày, dây và phao đều ảnh hưởng loài nào cắn, bao lâu cá tới và phao báo to hay nhỏ (`src/sim/setup.ts`).

- `?fast=1`: thu nhỏ thời gian chờ, và 1 "giờ" vé = 60 giây, để thử nhanh.
- `?seed=123`: lượt câu tái hiện được.
- `?store=local`: lưu trên máy dù đã cấu hình Supabase.

## Chạy trên máy

Cần Node 22 (`.nvmrc`).

```bash
npm install
npm run dev          # http://localhost:5173
npm run check        # typecheck + lint + unit test + build + e2e: chạy trước mỗi lần push
```

- Trang đo báo động: `/spike.html`. Bấm "Đo đầy đủ", chuyển sang ứng dụng khác, đợi 10 phút, rồi quay lại bấm "Chép kết quả JSON".
- Test schema DB (cần Postgres local ở 127.0.0.1:55432): `npm run test:db`

## Bật lưu lên server (Supabase)

1. Tạo project Supabase. Vào Authentication → Sign In / Providers, bật **Anonymous sign-ins** và **Allow manual linking** (để khách liên kết Google/email). Muốn liên kết Google thì bật thêm provider Google.
2. SQL Editor: chạy `supabase/migrations/0001_init.sql`, rồi `supabase/seed.sql`.
3. Chép `.env.example` thành `.env.local`, điền `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY` (key anon/publishable).
4. Xoá tài khoản cần Edge Function: `supabase functions deploy delete-account` (file `supabase/functions/delete-account/index.ts`).
5. `npm run dev`: góc trái sẽ ghi "Đang lưu lên server". Mất mạng thì cá và ca câu nằm trong hàng đợi trên máy, có mạng lại thì tự gửi.

Sửa `content/*.json` thì chạy `npm run seed:gen` để sinh lại `supabase/seed.sql` (có test bắt lỗi nếu quên).

## Cấu trúc

| thư mục | nội dung |
| --- | --- |
| `content/` | dữ liệu game: loài, địa điểm, mồi, đồ nghề, kiểu cân, sinh vật, nhiệm vụ (kiểm tra bằng zod) |
| `src/sim/` | lõi mô phỏng, TypeScript thuần, tất định: phao, cá cắn, kéo cá, đồng hồ, thời tiết |
| `src/data/` | `GameRepository`: bản lưu trên máy, bản Supabase, hàng đợi offline |
| `src/game/` | tiến độ người chơi (xu, xp, túi đồ, mồi) dạng hàm thuần; store Zustand |
| `src/ui/` | cảnh 3D (React Three Fiber), khung phao SVG, HUD, khay chuẩn bị, cửa hàng, ca câu, sổ tay, tài khoản |
| `src/alerts/` | báo động khi tab ẩn (timer trong worker) |
| `src/spike/` | spike M0: worker + đo độ trễ báo động |
| `supabase/migrations/` | schema Postgres + RLS + RPC |
| `replica/` | tài liệu thiết kế: recon, kiến trúc, nhận diện, bảng tính năng. Ảnh trong `replica/screens/` chỉ để tham khảo, không đưa vào game |
| `tests/e2e/` | Playwright |

Kiến trúc: [`replica/architecture.md`](replica/architecture.md).

## Deploy

Cloudflare Pages, nối với repo GitHub: build command `npm run build`, output `dist`, biến môi trường `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY`. Không bao giờ đưa `service_role` key vào repo hay vào biến `VITE_*`.

## Bản quyền

© 2026 chủ dự án. Mọi quyền được bảo lưu; repo này để public nhưng **chưa cấp giấy phép mã nguồn mở**. Tài nguyên bên thứ ba được ghi trong [`ASSETS.md`](ASSETS.md).

Đây là game độc lập, không liên quan tới game câu cá nào khác. Cơ chế câu đài thuộc về thể loại; tên, hình ảnh, chữ và mã nguồn đều được viết mới.
