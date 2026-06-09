import { describe, expect, it } from 'vitest';
import { parseJsonFromLlmText } from '@/lib/parse-llm-json';

describe('parseJsonFromLlmText', () => {
  it('extrai JSON dentro de fence markdown', () => {
    const raw =
      '```json\n{\n  "risk_score": 70,\n  "risk": "baixo",\n  "qualification_status": "aprovado"\n}\n```';
    const parsed = parseJsonFromLlmText(raw);
    expect(parsed?.risk_score).toBe(70);
    expect(parsed?.risk).toBe('baixo');
    expect(parsed?.qualification_status).toBe('aprovado');
  });

  it('extrai JSON com texto antes e depois', () => {
    const raw =
      'Segue análise:\n```json\n{"risk_score":85,"risk_flags":[{"flag":"ok","severity":"info","detail":"x"}]}\n```\nFim.';
    const parsed = parseJsonFromLlmText(raw);
    expect(parsed?.risk_score).toBe(85);
    expect(Array.isArray(parsed?.risk_flags)).toBe(true);
  });

  it('retorna null para JSON truncado', () => {
    const raw = '```json\n{"risk_score": 70, "risk_flags": [{"flag": "TAG';
    expect(parseJsonFromLlmText(raw)).toBeNull();
  });
});
