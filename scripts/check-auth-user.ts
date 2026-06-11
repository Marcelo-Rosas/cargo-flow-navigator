import { loadSupabaseScriptEnv } from './lib/load-supabase-env';
import { createClient } from '@supabase/supabase-js';

async function main() {
  const env = loadSupabaseScriptEnv();
  const client = createClient(env.url, env.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const email = process.argv[2];
  if (!email) {
    console.error('Uso: npx tsx scripts/check-auth-user.ts <email>');
    process.exit(1);
  }

  // Lista usuários filtrando por email (usando API admin)
  const { data, error } = await client.auth.admin.listUsers({
    page: 1,
    perPage: 100,
  });

  if (error) {
    console.error('Erro ao listar usuários:', error.message);
    process.exit(1);
  }

  const user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

  if (!user) {
    console.log(`❌ Usuário ${email} NÃO ENCONTRADO no Supabase Auth.`);
    console.log('Isso explica o erro 401. O usuário precisa ser recriado.');
    process.exit(0);
  }

  console.log(`✅ Usuário ${email} ENCONTRADO no Supabase Auth:`);
  console.log('  ID:', user.id);
  console.log('  Email confirmed:', user.email_confirmed_at ? 'Sim' : 'Não');
  console.log('  Created at:', user.created_at);
  console.log('  Last sign in:', user.last_sign_in_at || 'Nunca');
  console.log('  App metadata:', JSON.stringify(user.app_metadata));
  console.log('  User metadata:', JSON.stringify(user.user_metadata));

  // Verifica perfil no banco
  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('id, user_id, email, perfil, full_name')
    .ilike('email', email)
    .maybeSingle();

  if (profileError) {
    console.error('Erro ao buscar perfil:', profileError.message);
  } else if (profile) {
    console.log('\n📋 Perfil no banco:');
    console.log('  ID:', profile.id);
    console.log('  user_id:', profile.user_id);
    console.log('  Perfil:', profile.perfil);
    console.log('  Nome:', profile.full_name);
  } else {
    console.log('\n⚠️ Perfil no banco NÃO ENCONTRADO');
  }
}

main();
