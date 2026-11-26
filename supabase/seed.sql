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
  ('chim_trang', 'Chim trắng', 300, 2500, 1)
on conflict (id) do update set name_vi = excluded.name_vi, min_weight_g = excluded.min_weight_g,
  max_weight_g = excluded.max_weight_g, content_rev = excluded.content_rev;
insert into locations (id, name_vi, kind) values
  ('ho_dong_xanh', 'Hồ Đồng Xanh', 'fee_pond')
on conflict (id) do update set name_vi = excluded.name_vi, kind = excluded.kind;
delete from location_species where location_id in ('ho_dong_xanh');
insert into location_species (location_id, species_id) values
  ('ho_dong_xanh', 'ro_phi_den'),
  ('ho_dong_xanh', 'dieu_hong'),
  ('ho_dong_xanh', 'chep'),
  ('ho_dong_xanh', 'diec'),
  ('ho_dong_xanh', 'troi'),
  ('ho_dong_xanh', 'chim_trang'),
  ('ho_dong_xanh', 'tram_co'),
  ('ho_dong_xanh', 'me_hoa');
commit;
