# M0 spike: báo động khi tab ẩn

Trang đo: `/spike.html`. Mỗi mốc được đo bằng hai đường: timer trong Dedicated Worker và timer ở main thread (đối chứng). "Trễ" = thời điểm trang nhận sự kiện − mốc dự kiến.

## Kết quả đã có

| ngày | trình duyệt | tab | mốc | trễ worker | trễ main | âm thanh | thông báo |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-11-26 | Chromium (khung trình duyệt của Claude desktop, macOS) | **ẩn** | 5 s / 15 s / 30 s | 5 / 5 / 2 ms | 20 / 2 / 2 ms | `running` | không thử (chưa xin quyền) |
| 2026-11-26 | Chromium (như trên) | hiện | 5 s / 15 s / 30 s | 1 / 6 / 1 ms | 2 / 2 / 2 ms | `running` | không thử |
| 2026-11-26 | Chromium, WebKit (Playwright headless) | hiện | 5 s | dưới 1,5 s | dưới 1,5 s | — | — |

## Còn thiếu (điều kiện để đóng M0)

Mốc 2 phút và 10 phút khi tab ẩn chưa đo được: lượt đo bị thay bằng một lượt "Đo nhanh". Mốc 10 phút là mốc quan trọng nhất, vì Chrome chỉ bóp timer mạnh sau khi tab đã ẩn quá 5 phút.

Cần chạy "Đo đầy đủ" với ô "Thông báo hệ thống" được bật, rồi chuyển sang ứng dụng khác trong 10 phút, trên:

- [ ] Chrome (macOS)
- [ ] Safari (macOS): rủi ro lớn nhất, Notification trong worker có thể không có
- [ ] Firefox (macOS)
- [ ] Edge (Windows, nếu có máy)

Dán JSON từ nút "Chép kết quả JSON" vào đây. Mỗi trình duyệt cần trả lời được 3 câu: mốc 10 phút trễ bao nhiêu, thông báo có hiện không và gửi từ đâu (worker hay trang), âm thanh có kêu khi tab ẩn không.

## Quyết định sẽ rút ra

- Trễ 10 phút dưới 2 s trên mọi trình duyệt: giữ cửa sổ rỉa 10–40 s.
- Trễ tới khoảng 1 phút (bị bóp mạnh): báo động sớm ngay từ lúc "cá tới ổ", và kéo dài cửa sổ rỉa của lần cắn đầu tiên sau khi tab hiện lại.
- Safari không gửi được Notification từ worker: chuyển việc gửi thông báo về trang (đường dự phòng đã có sẵn trong spike).
