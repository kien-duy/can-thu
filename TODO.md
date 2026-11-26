# TODO

Cập nhật 2026-11-26. Đã xong M0 → M3, cộng thêm dòng cá, gãy cần, lưỡi câu. CI xanh ở commit `073f964`.
Trạng thái từng tính năng nằm trong [`replica/features.csv`](replica/features.csv): 37 yes, 3 partial, 10 no (chưa tính các mục skip).

Kế hoạch đã chốt cho lần làm tiếp: cho subagent làm **lần lượt** từng mục bên dưới (mỗi lần một agent, xong thì chạy lại toàn bộ test rồi mới sang mục sau), để chơi được đầy đủ trên máy.

## 1. Chạy Supabase local (chờ quyết định)

Chưa làm vì cần tải khoảng 5–7 GB image Docker (Supabase CLI `supabase` 3.4.0 + image chính thức từ Docker Hub). Ổ đĩa còn khoảng 35 GB. **Cần bạn đồng ý trước khi tải.**

- [ ] `npx supabase init`, đưa `supabase/migrations/0001_init.sql` và `supabase/seed.sql` vào config
- [ ] Bật anonymous sign-ins và manual linking trong `supabase/config.toml`
- [ ] Script sinh `.env.local` từ `supabase status` (URL + anon key; không đưa service_role vào `VITE_*`)
- [ ] Chạy thử: đăng nhập khách, ghi cá qua RPC, sổ tay đọc từ server, hàng đợi offline (tắt server giữa chừng rồi bật lại), liên kết email qua Mailpit local, `supabase functions serve delete-account`
- [ ] Script `npm run dev:full` + mục hướng dẫn trong README
- [ ] Tuỳ chọn: một bộ e2e chạy với Supabase local (chạy tay, không đưa vào CI)
- Không thử được trên máy: liên kết Google (cần OAuth client trong Google Cloud của bạn)

## 2. Làm dở

- [ ] Kiểu kéo cá thứ hai trong Cài đặt: rê chuột hoặc ngón tay để chỉnh góc cần (bản tham khảo có kiểu này)
- [ ] Lưu tiến độ lên server, liên kết tài khoản: xong khi mục 1 chạy thử đạt

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
- [ ] Bảng xếp hạng: cần chuyển phần tính kết quả lên server (xem "Gian lận" trong `replica/architecture.md`); làm sau mục 1

## 5. Việc chỉ bạn làm được

- [ ] Tạo project Supabase cloud theo README (khi muốn đưa lên mạng)
- [ ] Nối Cloudflare Pages: repo `kien-duy/can-thu`, build `npm run build`, output `dist`, biến `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY`
- [ ] Đo báo động 10 phút trên Chrome và Safari thật: `npm run dev`, mở `/spike.html`, "Đo đầy đủ", bật thông báo, rời tab 10 phút, rồi chép JSON vào `replica/m0-spike-results.md`
- [ ] Đồ hoạ: chọn model CC0 (Kenney, Quaternius, Poly Haven) hoặc nhờ người vẽ theo logo brief trong `replica/brand.md`; ghi nguồn vào `ASSETS.md`

## Ghi chú cho lần làm tiếp

- Chạy trước mỗi lần push: `npm run typecheck && npm run lint && npm test && npm run build && npx playwright test --project=chromium --project=webkit`. Firefox không mở được trong Playwright trên máy này (lỗi môi trường); CI có chạy Firefox.
- Đừng để `vite preview` chạy sẵn ở cổng 4173: Playwright sẽ dùng lại server đó và test nhầm bản build cũ.
- Test DB: cần Postgres local ở 127.0.0.1:55432, rồi `npm run test:db`.
- Sửa `content/*.json` (loài, địa điểm) thì chạy `npm run seed:gen`.
- `?fast=1&seed=3&store=local` để thử nhanh; ở `?fast=1` store được gắn vào `globalThis.__canThu` cho e2e.
