// Supabase Edge Function (Deno): xoá tài khoản của chính người gọi.
// Deploy: supabase functions deploy delete-account
// SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY được Supabase tự cấp cho function;
// service role chỉ nằm ở đây, không bao giờ ở client.
// Dữ liệu của người chơi tự xoá theo `on delete cascade` (xem migrations/0001_init.sql).
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers: cors })

  const auth = req.headers.get('Authorization') ?? ''
  const asUser = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
  })
  const { data, error } = await asUser.auth.getUser()
  if (error || !data.user) return new Response('unauthorized', { status: 401, headers: cors })

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const del = await admin.auth.admin.deleteUser(data.user.id)
  if (del.error) return new Response(del.error.message, { status: 500, headers: cors })
  return new Response(JSON.stringify({ deleted: data.user.id }), { headers: { ...cors, 'Content-Type': 'application/json' } })
})
