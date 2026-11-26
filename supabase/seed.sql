-- TỰ SINH từ content/*.json bằng `npm run seed:gen`. Đừng sửa tay.
begin;
insert into species (id, name_vi, min_weight_g, max_weight_g, content_rev) values
  ('ro_phi_den', 'Rô phi đen', 120, 1500, 1),
  ('dieu_hong', 'Điêu hồng', 150, 1500, 1),
  ('chep', 'Chép', 300, 6000, 1),
  ('diec', 'Diếc', 80, 600, 1),
  ('tram_co', 'Trắm cỏ', 800, 10000, 1),
  ('me_hoa', 'Mè hoa', 1000, 12000, 1),
  ('troi', 'Trôi', 200, 2000, 1),
  ('chim_trang', 'Chim trắng', 300, 2500, 1),
  ('muong', 'Mương', 20, 200, 1),
  ('ro_dong', 'Rô đồng', 30, 300, 1),
  ('chay_mat_do', 'Chày mắt đỏ', 150, 1500, 1),
  ('nganh', 'Ngạnh', 150, 1500, 1),
  ('lang', 'Lăng', 500, 8000, 1),
  ('tram_den', 'Trắm đen', 1500, 25000, 1),
  ('me_trang', 'Mè trắng', 800, 8000, 1)
on conflict (id) do update set name_vi = excluded.name_vi, min_weight_g = excluded.min_weight_g,
  max_weight_g = excluded.max_weight_g, content_rev = excluded.content_rev;
insert into locations (id, name_vi, kind) values
  ('ho_dong_xanh', 'Hồ Đồng Xanh', 'fee_pond'),
  ('ben_song_lang', 'Bến sông làng', 'river'),
  ('ho_nui_may', 'Hồ núi Mây', 'mountain_lake')
on conflict (id) do update set name_vi = excluded.name_vi, kind = excluded.kind;
delete from location_species where location_id in ('ho_dong_xanh', 'ben_song_lang', 'ho_nui_may');
insert into location_species (location_id, species_id) values
  ('ho_dong_xanh', 'ro_phi_den'),
  ('ho_dong_xanh', 'dieu_hong'),
  ('ho_dong_xanh', 'chep'),
  ('ho_dong_xanh', 'diec'),
  ('ho_dong_xanh', 'troi'),
  ('ho_dong_xanh', 'chim_trang'),
  ('ho_dong_xanh', 'tram_co'),
  ('ho_dong_xanh', 'me_hoa'),
  ('ben_song_lang', 'muong'),
  ('ben_song_lang', 'ro_dong'),
  ('ben_song_lang', 'chay_mat_do'),
  ('ben_song_lang', 'diec'),
  ('ben_song_lang', 'troi'),
  ('ben_song_lang', 'chep'),
  ('ben_song_lang', 'nganh'),
  ('ben_song_lang', 'lang'),
  ('ho_nui_may', 'me_trang'),
  ('ho_nui_may', 'chep'),
  ('ho_nui_may', 'diec'),
  ('ho_nui_may', 'tram_co'),
  ('ho_nui_may', 'me_hoa'),
  ('ho_nui_may', 'tram_den'),
  ('ho_nui_may', 'lang');
commit;
