import { createClient } from 'jsr:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
const VALID_PROFILES = ['admin', 'operacional', 'financeiro'];
Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }
  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({
          error: 'Method not allowed',
        }),
        {
          status: 405,
          headers: {
            ...corsHeaders,
            'content-type': 'application/json',
          },
        }
      );
    }
    // Validate auth header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({
          error: 'Missing Authorization header',
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            'content-type': 'application/json',
          },
        }
      );
    }
    // Parse body
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({
          error: 'Invalid JSON body',
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'content-type': 'application/json',
          },
        }
      );
    }
    // Validate fields
    if (!body.email || !body.email.includes('@')) {
      return new Response(
        JSON.stringify({
          error: 'E-mail inválido',
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'content-type': 'application/json',
          },
        }
      );
    }
    if (!body.email.toLowerCase().endsWith('@vectracargo.com.br')) {
      return new Response(
        JSON.stringify({
          error: 'Somente e-mails @vectracargo.com.br são permitidos',
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'content-type': 'application/json',
          },
        }
      );
    }
    if (!body.fullName || body.fullName.trim().length < 2) {
      return new Response(
        JSON.stringify({
          error: 'Nome completo obrigatório',
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'content-type': 'application/json',
          },
        }
      );
    }
    if (!VALID_PROFILES.includes(body.perfil)) {
      return new Response(
        JSON.stringify({
          error: 'Perfil inválido',
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'content-type': 'application/json',
          },
        }
      );
    }
    // Check caller is admin using their JWT
    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_ANON_KEY'),
      {
        global: {
          headers: {
            authorization: authHeader,
          },
        },
      }
    );
    const { data: isAdmin, error: adminCheckError } = await callerClient.rpc('is_admin');
    if (adminCheckError || !isAdmin) {
      return new Response(
        JSON.stringify({
          error: 'Somente administradores podem convidar usuários',
        }),
        {
          status: 403,
          headers: {
            ...corsHeaders,
            'content-type': 'application/json',
          },
        }
      );
    }
    // Use service role to invite user
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
    const base =
      Deno.env.get('SITE_URL') ?? 'https://cargo-flow-navigator-marcelo-rosas-projects.vercel.app';
    const redirectTo = `${base}/auth`;
    const { data: inviteData, error: inviteError } =
      await serviceClient.auth.admin.inviteUserByEmail(body.email, {
        data: {
          full_name: body.fullName,
        },
        redirectTo,
      });
    if (inviteError) {
      return new Response(
        JSON.stringify({
          error: `Erro ao convidar: ${inviteError.message}`,
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'content-type': 'application/json',
          },
        }
      );
    }
    // Update the profile with chosen perfil (trigger created it with default 'operacional')
    if (inviteData?.user?.id && body.perfil !== 'operacional') {
      await serviceClient
        .from('profiles')
        .update({
          perfil: body.perfil,
          full_name: body.fullName,
        })
        .or(`id.eq.${inviteData.user.id},user_id.eq.${inviteData.user.id}`);
    }
    return new Response(
      JSON.stringify({
        success: true,
        userId: inviteData?.user?.id,
        message: `Convite enviado para ${body.email}`,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'content-type': 'application/json',
        },
      }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: String(e),
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'content-type': 'application/json',
        },
      }
    );
  }
});
