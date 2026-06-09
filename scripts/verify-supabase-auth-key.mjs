#!/usr/bin/env node
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env' });
config({ path: '.env.local', override: true });

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY');
  process.exit(1);
}

const payload = key.startsWith('eyJ')
  ? JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString())
  : null;
console.log('url', url);
console.log(
  'key_type',
  key.startsWith('sb_publishable_') ? 'publishable' : key.startsWith('eyJ') ? 'jwt' : 'unknown'
);
if (payload) console.log('jwt_ref', payload.ref, 'role', payload.role);

const sb = createClient(url, key);
const { error: authError } = await sb.auth.signInWithPassword({
  email: 'invalid@example.com',
  password: 'wrong-password',
});

if (authError?.message === 'Invalid API key') {
  console.error('FAIL: Invalid API key — chave ainda incorreta');
  process.exit(1);
}

console.log('auth_endpoint', authError ? `ok (${authError.message})` : 'ok');
const { error: restError } = await sb.from('company_settings').select('id').limit(1);
console.log('rest_endpoint', restError ? restError.message : 'ok');
process.exit(0);
