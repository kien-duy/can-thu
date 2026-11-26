# Cần Thủ

Game câu đài 3D trên web cho người vừa làm việc vừa muốn câu. Bạn thả câu rồi quay lại làm việc; khi cá bắt đầu rỉa mồi, game báo cho bạn quay lại.

Trạng thái: **M0**: khung dự án và trang đo báo động khi tab ẩn. Vòng câu đầu tiên có ở M1.

## Chạy trên máy

Cần Node 22 (`.nvmrc`).

```bash
npm install
npm run dev          # http://localhost:5173
npm run check        # typecheck + lint + unit test + build + e2e: chạy trước mỗi lần push
```

- Trang đo báo động: `/spike.html`. Bấm "Đo đầy đủ", chuyển sang ứng dụng khác, đợi 10 phút, rồi quay lại bấm "Chép kết quả JSON".
- Test schema DB (cần Postgres local ở 127.0.0.1:55432): `npm run test:db`

## Cấu trúc

| thư mục | nội dung |
| --- | --- |
| `src/sim/` | lõi mô phỏng, TypeScript thuần, tất định, test bằng Vitest |
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
