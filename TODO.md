# TODO

Cập nhật 2026-11-27. Đã xong M0 → M3, cộng thêm dòng cá, gãy cần, lưỡi câu. CI xanh ở commit `073f964`.
Trạng thái từng tính năng nằm trong [`replica/features.csv`](replica/features.csv): 37 yes, 3 partial, 10 no (chưa tính các mục skip).

Kế hoạch đã chốt cho lần làm tiếp: cho subagent làm **lần lượt** từng mục bên dưới (mỗi lần một agent, xong thì chạy lại toàn bộ test rồi mới sang mục sau), để chơi được đầy đủ trên máy.

## 1. Server và DB chạy trên máy (xong 2026-11-27)

Bỏ Supabase, chuyển sang mô hình caro-clone: server Hono trong `server/`, Drizzle, PGlite khi chạy trên máy và Postgres (Neon) khi lên mạng. `npm run dev` là có cả game lẫn API, không cần Docker.

- [x] Khách tạo ngay khi mở game; tạo tài khoản email + mật khẩu giữ nguyên cá đã câu; đăng nhập ở máy khác; đăng xuất; xoá tài khoản
- [x] Quy tắc ghi cá chuyển từ RPC sang `server/game.ts`, có 19 unit test trên PGlite
- [x] e2e `tests/e2e/account.spec.ts`: câu một con bằng khách, tạo tài khoản, đăng nhập ở trình duyệt khác thấy cùng sổ tay
- [x] Sửa lỗi cũ trong hàng đợi offline: `flush()` lúc hàng đợi trống làm kẹt mọi lệnh ghi sau đó
- [x] Màn chọn vé có lối "Đã có tài khoản? Đăng nhập" (trước đây màn này che menu, máy mới không đăng nhập được)
- [ ] Liên kết Google: đã code (`/api/auth/google`), chưa thử vì cần OAuth client trong Google Cloud của bạn
- [ ] Dọn tài khoản khách bỏ hoang (chưa câu con nào, quá 30 ngày không mở) và phiên hết hạn (`sweepSessions` đã có, chưa gọi định kỳ)
- [ ] Quên mật khẩu: chưa có (cần gửi email)

## 2. Làm dở

- [ ] Kiểu kéo cá thứ hai trong Cài đặt: rê chuột hoặc ngón tay để chỉnh góc cần (bản tham khảo có kiểu này)

## 3. Rà lại sau ba tính năng mới

- [ ] Xem bằng mắt trong cảnh 3D: dây kéo theo hướng cá chạy, cần nghiêng khi dòng cá, hình cần gãy (chưa ai xem; e2e vòng chơi chạy ở chế độ văn phòng)
- [ ] Độ khó với người mới: lưỡi số 3 khởi đầu làm cá trên 2 kg hay tuột (xác suất mỗi nhịp vùng chạy = `min(0.5, 0.25 × (cân/2000 − 1))`). Cân nhắc giảm, hoặc gợi ý mua lưỡi số 5 ngay sau lần tuột đầu tiên
- [ ] Dây 1.5 mua được từ cấp 1; lắp với cần tre thì cần gãy trước thẻo. Đã có cảnh báo trong khay; xem có nên gợi ý ngay trong cửa hàng không
- [ ] Lời gợi ý trong trận kéo đổi liên tục trong vùng `aria-live`: trình đọc màn hình đọc quá nhiều. Chỉ báo khi đổi hướng cá, hoặc tách khỏi `aria-live`
- [ ] Kinh tế: ca 2 tiếng chơi chăm kiếm khá nhiều xu; đo lại thu nhập theo giờ và chỉnh giá vé, giá cá

## 4. M4: có thì tốt

- [ ] Thành tích có bậc, danh hiệu
- [ ] PWA: manifest, service worker, cài lên màn hình chính
- [ ] Tiếng Anh: tách chuỗi ra file i18n
- [ ] Mặt cắt 2D: nhìn ngang bờ, thấy dây, chì, mồi, cá dưới nước
- [ ] Sơ đồ hồ, đổi chỗ ngồi
- [ ] Hàng xóm NPC câu quanh hồ
- [ ] Đi dạo quanh hồ, quán nước
- [ ] Đồ trang trí (chỉ đổi hình thức)
- [ ] Bản mobile: bố cục dọc, nút chạm to, thử trên iPhone/Android
- [ ] Bảng xếp hạng: cần chuyển phần tính kết quả lên server (xem "Gian lận" trong `replica/architecture.md`)

## 5. Việc chỉ bạn làm được

- [ ] Khi muốn đưa lên mạng: tạo DB Neon và một host chạy Node (Render như caro-clone), theo mục "Deploy" trong README
- [ ] Nếu muốn nút Google: tạo OAuth client trong Google Cloud, đặt `GOOGLE_CLIENT_ID` và `GOOGLE_CLIENT_SECRET`
- [ ] Đo báo động 10 phút trên Chrome và Safari thật: `npm run dev`, mở `/spike.html`, "Đo đầy đủ", bật thông báo, rời tab 10 phút, rồi chép JSON vào `replica/m0-spike-results.md`
- [ ] Đồ hoạ: chọn model CC0 (Kenney, Quaternius, Poly Haven) hoặc nhờ người vẽ theo logo brief trong `replica/brand.md`; ghi nguồn vào `ASSETS.md`

## Ghi chú cho lần làm tiếp

- Chạy trước mỗi lần push: `npm run typecheck && npm run lint && npm test && npm run build && npx playwright test --project=chromium --project=webkit`. Firefox không mở được trong Playwright trên máy này (lỗi môi trường); CI có chạy Firefox.
- Đừng để `vite preview` chạy sẵn ở cổng 4173: Playwright sẽ dùng lại server đó và test nhầm bản build cũ.
- DB trên máy nằm ở `.data/pglite` (xoá là về trống). Đổi `server/db/schema.ts` thì `npm run db:generate`.
- e2e chạy bản production thật (`npm start`, PGlite trong bộ nhớ) ở cổng 4173.
- `?fast=1&seed=3&store=local` để thử nhanh; ở `?fast=1` store được gắn vào `globalThis.__canThu` cho e2e.
