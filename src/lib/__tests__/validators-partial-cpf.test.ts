import { describe, expect, it } from 'vitest';
import { validateOptionalPartialCpf } from '@/lib/validators';

describe('validateOptionalPartialCpf', () => {
  it('aceita vazio', () => {
    expect(validateOptionalPartialCpf('')).toBe(true);
    expect(validateOptionalPartialCpf(null)).toBe(true);
  });

  it('aceita CPF parcial mascarado da Receita', () => {
    expect(validateOptionalPartialCpf('***982984**')).toBe(true);
    expect(validateOptionalPartialCpf('982984')).toBe(true);
  });

  it('valida CPF completo com dígito verificador', () => {
    expect(validateOptionalPartialCpf('529.982.247-25')).toBe(true);
  });

  it('rejeita CPF completo inválido', () => {
    expect(validateOptionalPartialCpf('123.456.789-00')).toBe(false);
  });

  it('rejeita mais de 11 dígitos', () => {
    expect(validateOptionalPartialCpf('123456789012')).toBe(false);
    expect(validateOptionalPartialCpf('123.456.789-012')).toBe(false);
  });
});
