const INJECTION_PATTERNS: Array<{ label: string; regex: RegExp }> = [
  {
    label: 'override_instructions',
    regex: /\b(ignore|disregard)\b.{0,60}\b(instruction|system)\b/i,
  },
  {
    label: 'reveal_prompt',
    regex: /\b(reveal|show|print|dump)\b.{0,40}\b(system prompt|hidden prompt)\b/i,
  },
  {
    label: 'secret_exfiltration',
    regex: /\b(api[_\s-]?key|token|secret|password)\b.{0,40}\b(show|reveal|expose|send)\b/i,
  },
  { label: 'tool_abuse', regex: /\b(call|invoke|execute)\b.{0,60}\b(tool|function)\b/i },
];

const REDACTION_PATTERNS: Array<{ regex: RegExp; replacement: string }> = [
  { regex: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, replacement: 'Bearer [REDACTED]' },
  { regex: /\b(sk|rk|pk|AIza)[A-Za-z0-9\-_]{12,}\b/g, replacement: '[REDACTED_KEY]' },
  { regex: /\b[A-Fa-f0-9]{32,}\b/g, replacement: '[REDACTED_TOKEN]' },
  {
    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    replacement: '[REDACTED_EMAIL]',
  },
];

const MAX_PROMPT_CHARS = 40_000;

export function redactSensitiveText(input: string): string {
  return REDACTION_PATTERNS.reduce((acc, rule) => acc.replace(rule.regex, rule.replacement), input);
}

export function sanitizeErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  return redactSensitiveText(raw).slice(0, 600);
}

export function detectPromptInjectionSignals(input: string): string[] {
  const signals: string[] = [];
  for (const rule of INJECTION_PATTERNS) {
    if (rule.regex.test(input)) signals.push(rule.label);
  }
  return signals;
}

export function assertSafePromptInput(params: { prompt: string; system?: string }): void {
  const prompt = params.prompt || '';
  const system = params.system || '';
  const fullInput = `${system}\n${prompt}`;

  if (fullInput.length > MAX_PROMPT_CHARS) {
    throw new Error('Prompt rejected: input exceeds maximum allowed size.');
  }

  const signals = detectPromptInjectionSignals(fullInput);
  if (signals.length > 0) {
    throw new Error(`Prompt rejected by security policy (${signals.join(', ')}).`);
  }
}
