\set QUIET on
insert into species values ('ro_phi_den','Rô phi đen',100,3000), ('chep','Chép',200,12000);
insert into locations (id,name_vi,kind) values ('ho1','Hồ 1','fee_pond'), ('song','Sông','river');
insert into location_species values ('ho1','ro_phi_den'), ('song','chep');
insert into auth.users (id) values ('11111111-1111-1111-1111-111111111111'), ('22222222-2222-2222-2222-222222222222');
select 'bootstrap profiles='||count(*) from profiles;
select 'bootstrap state coins='||min(coins) from player_state;

create or replace function expect_err(sql text, code text) returns text language plpgsql as $$
begin execute sql; return 'FAIL (no error) '||code;
exception when others then return case when sqlerrm like '%'||code||'%' then 'PASS '||code else 'FAIL got '||sqlerrm end; end $$;
grant execute on function expect_err to authenticated;

set role authenticated;
set request.jwt.sub = '11111111-1111-1111-1111-111111111111';
select 'start: '||(start_session('aaaaaaaa-0000-0000-0000-000000000001','ho1','paid_shift',200, now()-interval '30 minutes', now()+interval '90 minutes','{}')).kind;
select 'retry start ok: '||(start_session('aaaaaaaa-0000-0000-0000-000000000001','ho1','paid_shift',200, now()-interval '30 minutes', now()+interval '90 minutes','{}')).id;
select 'catch: '||(record_catch(jsonb_build_object('id','cccccccc-0000-0000-0000-000000000001','session_id','aaaaaaaa-0000-0000-0000-000000000001','species_id','ro_phi_den','weight_g',850,'caught_at',now()-interval '5 minutes','local_hour',9,'weather_kind','sunny'))).weight_g;
select 'idempotent: '||(record_catch(jsonb_build_object('id','cccccccc-0000-0000-0000-000000000001','session_id','aaaaaaaa-0000-0000-0000-000000000001','species_id','ro_phi_den','weight_g',850,'caught_at',now()-interval '5 minutes','local_hour',9,'weather_kind','sunny'))).id;
select 'count after retry='||count(*) from catches;
select expect_err($q$select record_catch(jsonb_build_object('id',gen_random_uuid(),'session_id','aaaaaaaa-0000-0000-0000-000000000001','species_id','ro_phi_den','weight_g',99999,'caught_at',now(),'local_hour',9,'weather_kind','sunny'))$q$,'weight_out_of_range');
select expect_err($q$select record_catch(jsonb_build_object('id',gen_random_uuid(),'session_id','aaaaaaaa-0000-0000-0000-000000000001','species_id','chep','weight_g',1000,'caught_at',now(),'local_hour',9,'weather_kind','sunny'))$q$,'species_not_in_location');
select expect_err($q$select record_catch(jsonb_build_object('id',gen_random_uuid(),'session_id','aaaaaaaa-0000-0000-0000-000000000001','species_id','ro_phi_den','weight_g',500,'caught_at',now()-interval '3 hours','local_hour',9,'weather_kind','sunny'))$q$,'catch_outside_session');
select expect_err($q$insert into catches (id,user_id,session_id,species_id,location_id,weight_g,caught_at,local_hour,weather_kind) values (gen_random_uuid(),'11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000001','ro_phi_den','ho1',500,now(),9,'sunny')$q$,'permission denied');
-- rate limit: 5 more within same minute -> 6 total, 7th fails
select count(record_catch(jsonb_build_object('id',gen_random_uuid(),'session_id','aaaaaaaa-0000-0000-0000-000000000001','species_id','ro_phi_den','weight_g',300,'caught_at',now()-interval '20 seconds','local_hour',9,'weather_kind','sunny'))) from generate_series(1,6);
select expect_err($q$select record_catch(jsonb_build_object('id',gen_random_uuid(),'session_id','aaaaaaaa-0000-0000-0000-000000000001','species_id','ro_phi_den','weight_g',300,'caught_at',now()-interval '10 seconds','local_hour',9,'weather_kind','sunny'))$q$,'too_many_catches');
select 'handbook: '||species_id||' n='||total_caught||' rec='||record_weight_g||' hour='||favourite_hour from handbook_entries;
select 'save v1='||save_player_state(0, 300, 10, '{"rig":"4-2"}', 1);
select 'stale save='||save_player_state(0, 999, 10, '{}', 1);
select record_sighting('buom_vang','ho1',now()); select record_sighting('buom_vang','ho1',now());
select 'sighting times='||times_seen from wildlife_sightings;
-- new session auto-closes old
select 'start2: '||(start_session('aaaaaaaa-0000-0000-0000-000000000002','song','free',0, now(), null,'{}')).kind;
select 'old outcome='||outcome from fishing_sessions where id='aaaaaaaa-0000-0000-0000-000000000001';
select 'end: '||(end_session('aaaaaaaa-0000-0000-0000-000000000002', now(), 'released', 0)).outcome;

-- other user sees nothing
set request.jwt.sub = '22222222-2222-2222-2222-222222222222';
select 'other user catches='||count(*) from catches;
select 'other user handbook='||count(*) from handbook_entries;
select expect_err($q$select record_catch(jsonb_build_object('id',gen_random_uuid(),'session_id','aaaaaaaa-0000-0000-0000-000000000002','species_id','chep','weight_g',1000,'caught_at',now(),'local_hour',9,'weather_kind','sunny'))$q$,'session_not_found');
reset role;
set role anon; set request.jwt.sub = '';
select expect_err($q$select save_player_state(0,1,1,'{}',1)$q$,'permission denied');
