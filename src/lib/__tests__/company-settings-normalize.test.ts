import { describe, expect, it } from 'vitest';
import { fixMojibake } from '@/lib/fix-mojibake';
import {
  normalizeCompanySettingsPayload,
  normalizeRepresentativeCpf,
} from '@/lib/company-settings-normalize';

describe('fixMojibake', () => {
  it('corrige São Pedro', () => {
    expect(fixMojibake('SÃ£o Pedro')).toBe('São Pedro');
  });

  it('mantém texto já correto', () => {
    expect(fixMojibake('Navegantes')).toBe('Navegantes');
  });
});

describe('normalizeCompanySettingsPayload', () => {
  it('persiste CNPJ e CEP só com dígitos', () => {
    const out = normalizeCompanySettingsPayload({
      legal_name: 'VECTRA CARGO LTDA',
      cnpj: '59.650.913/0001-04',
      address_zip: '88370-053',
      address_street: 'Rua A',
      address_number: '1',
      address_city: 'Navegantes',
      address_state: 'sc',
    });
    expect(out.cnpj).toBe('59650913000104');
    expect(out.address_zip).toBe('88370053');
    expect(out.address_state).toBe('SC');
  });
});

describe('normalizeRepresentativeCpf', () => {
  it('aceita vazio', () => {
    expect(normalizeRepresentativeCpf('')).toBeNull();
  });

  it('aceita CPF mascarado da Receita', () => {
    expect(normalizeRepresentativeCpf('***982984**')).toBe('982984');
  });
});
