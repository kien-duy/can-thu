#!/bin/zsh
# Chạy test schema trên một Postgres local (mặc định 127.0.0.1:55432, user postgres).
# Mong đợi: mọi dòng PASS, không có FAIL hay ERROR.
set -e
H=${PGHOST:-127.0.0.1}; PORT=${PGPORT:-55432}; D=$(dirname $0)
P() { psql -h $H -p $PORT -U postgres -v ON_ERROR_STOP=1 -q "$@"; }
P -tAc "select 1 from pg_roles where rolname='anon'" | grep -q 1 || P -c "create role anon nologin; create role authenticated nologin;"
P -c "drop database if exists can_thu_test" -c "create database can_thu_test"
P -d can_thu_test -f $D/00-supabase-auth-stub.sql -f $D/../../supabase/migrations/0001_init.sql
P -d can_thu_test -c "grant select on all tables in schema public to anon, authenticated"
out=$(psql -h $H -p $PORT -U postgres -d can_thu_test -tA -f $D/10-schema-tests.sql 2>&1)
echo "$out"
echo "$out" | grep -qE "FAIL|ERROR" && { echo "==> CÓ TEST HỎNG"; exit 1; } || echo "==> TẤT CẢ ĐẠT"
