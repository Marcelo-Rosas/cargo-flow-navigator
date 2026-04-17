-- VEC-116: Driver qualification outreach
-- 1. Adiciona colunas Meta ao notification_templates (referenciadas no notification-hub mas ausentes)
-- 2. Adiciona rastreio de outreach ao driver_qualifications
-- 3. Insere templates de outreach com texto oficial aprovado

-- ─── notification_templates: colunas Meta ────────────────────────────────────
ALTER TABLE public.notification_templates
  ADD COLUMN IF NOT EXISTS is_meta_approved   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS meta_template_name TEXT,
  ADD COLUMN IF NOT EXISTS meta_language_code TEXT    DEFAULT 'pt_BR',
  ADD COLUMN IF NOT EXISTS meta_variables     JSONB;

-- ─── driver_qualifications: rastreio de outreach ─────────────────────────────
ALTER TABLE public.driver_qualifications
  ADD COLUMN IF NOT EXISTS whatsapp_sent_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS whatsapp_reminded_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_driver_qualifications_dispatch
  ON public.driver_qualifications (whatsapp_sent_at)
  WHERE status = 'pendente' AND whatsapp_sent_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_driver_qualifications_remind
  ON public.driver_qualifications (whatsapp_sent_at)
  WHERE status = 'pendente' AND whatsapp_reminded_at IS NULL;

-- ─── Templates de outreach ────────────────────────────────────────────────────
INSERT INTO public.notification_templates
  (key, channel, body_template, is_meta_approved, meta_template_name, meta_language_code, meta_variables, active)
VALUES
  (
    'driver_qualification_outreach',
    'whatsapp',
    $tmpl$Olá {{nome}}! 👋
Sou a Navi, assistente da Vectra Cargo.

Temos cargas disponíveis e queremos cadastrar seu
veículo em nossa rede de transportadores.

Leva menos de 2 minutos:
👉 {{link}}

Qualquer dúvida é só responder aqui.$tmpl$,
    true,
    'vectra_cadastro_motorista_w0',
    'pt_BR',
    '[{"type":"named","key":"nome"},{"type":"named","key":"link"}]'::jsonb,
    true
  ),
  (
    'driver_qualification_reminder_msg',
    'whatsapp',
    $tmpl$Olá {{nome}}! Seu formulário de qualificação ainda está pendente.

Leva menos de 2 minutos:
👉 {{link}}

Qualquer dúvida é só responder aqui.$tmpl$,
    true,
    'qualificacao_motorista_w1',
    'pt_BR',
    '[{"type":"named","key":"nome"},{"type":"named","key":"link"}]'::jsonb,
    true
  ),
  (
    'driver_qualification_closing',
    'whatsapp',
    $tmpl$Olá {{nome}}, esta é nossa última tentativa de contato sobre o cadastro de transportador na Vectra Cargo.

Se não tem interesse responda - não.$tmpl$,
    true,
    'qualificacao_motorista_w2',
    'pt_BR',
    '[{"type":"named","key":"nome"}]'::jsonb,
    true
  )
ON CONFLICT (key) DO NOTHING;
