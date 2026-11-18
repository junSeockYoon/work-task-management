require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { createClient } = require('@supabase/supabase-js');

function requireConfig() {
  const url = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const publishable = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !secret || !publishable) {
    throw new Error(
      'SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY 가 필요합니다. 프로젝트 루트의 .env 파일에 넣어 주세요.'
    );
  }
  return { url, secret, publishable };
}

const config = requireConfig();

const admin = createClient(config.url, config.secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function authClient() {
  return createClient(config.url, config.publishable, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

module.exports = { admin, authClient };
