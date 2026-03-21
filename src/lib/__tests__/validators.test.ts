import { describe, it, expect } from 'vitest';
import {
  validateCpf,
  validateCnpj,
  validateCpfOrCnpj,
  validatePhone,
  validateCep,
  validatePlate,
} from '../validators';

describe('validateCpf', () => {
  it('accepts valid CPFs', () => {
    expect(validateCpf('529.982.247-25')).toBe(true);
    expect(validateCpf('52998224725')).toBe(true);
    expect(validateCpf('111.444.777-35')).toBe(true);
  });

  it('rejects all-same-digit CPFs', () => {
    expect(validateCpf('111.111.111-11')).toBe(false);
    expect(validateCpf('000.000.000-00')).toBe(false);
    expect(validateCpf('999.999.999-99')).toBe(false);
  });

  it('rejects wrong check digits', () => {
    expect(validateCpf('529.982.247-26')).toBe(false);
    expect(validateCpf('529.982.247-15')).toBe(false);
  });

  it('rejects wrong length', () => {
    expect(validateCpf('123')).toBe(false);
    expect(validateCpf('1234567890')).toBe(false);
    expect(validateCpf('123456789012')).toBe(false);
  });

  it('handles formatted input', () => {
    expect(validateCpf('529.982.247-25')).toBe(true);
  });
});

describe('validateCnpj', () => {
  it('accepts valid CNPJs', () => {
    expect(validateCnpj('11.222.333/0001-81')).toBe(true);
    expect(validateCnpj('11222333000181')).toBe(true);
  });

  it('rejects all-same-digit CNPJs', () => {
    expect(validateCnpj('11.111.111/1111-11')).toBe(false);
    expect(validateCnpj('00.000.000/0000-00')).toBe(false);
  });

  it('rejects wrong check digits', () => {
    expect(validateCnpj('11.222.333/0001-82')).toBe(false);
  });

  it('rejects wrong length', () => {
    expect(validateCnpj('123')).toBe(false);
    expect(validateCnpj('1234567890123')).toBe(false);
    expect(validateCnpj('123456789012345')).toBe(false);
  });
});

describe('validateCpfOrCnpj', () => {
  it('validates CPF (11 digits)', () => {
    expect(validateCpfOrCnpj('529.982.247-25')).toBe(true);
    expect(validateCpfOrCnpj('529.982.247-26')).toBe(false);
  });

  it('validates CNPJ (14 digits)', () => {
    expect(validateCpfOrCnpj('11.222.333/0001-81')).toBe(true);
    expect(validateCpfOrCnpj('11.222.333/0001-82')).toBe(false);
  });

  it('rejects other lengths', () => {
    expect(validateCpfOrCnpj('12345')).toBe(false);
    expect(validateCpfOrCnpj('')).toBe(false);
  });
});

describe('validatePhone', () => {
  it('accepts 10-digit landline', () => {
    expect(validatePhone('(11) 3456-7890')).toBe(true);
    expect(validatePhone('1134567890')).toBe(true);
  });

  it('accepts 11-digit mobile', () => {
    expect(validatePhone('(11) 99999-9999')).toBe(true);
    expect(validatePhone('11999999999')).toBe(true);
  });

  it('rejects wrong length', () => {
    expect(validatePhone('123')).toBe(false);
    expect(validatePhone('123456789012')).toBe(false);
  });
});

describe('validateCep', () => {
  it('accepts 8-digit CEP', () => {
    expect(validateCep('01310-100')).toBe(true);
    expect(validateCep('88370000')).toBe(true);
  });

  it('rejects wrong length', () => {
    expect(validateCep('1234567')).toBe(false);
    expect(validateCep('123456789')).toBe(false);
  });
});

describe('validatePlate', () => {
  it('accepts old format (ABC1234)', () => {
    expect(validatePlate('ABC1234')).toBe(true);
    expect(validatePlate('ABC-1234')).toBe(true);
    expect(validatePlate('abc1234')).toBe(true);
  });

  it('accepts Mercosul format (ABC1D23)', () => {
    expect(validatePlate('ABC1D23')).toBe(true);
    expect(validatePlate('ABC-1D23')).toBe(true);
  });

  it('rejects invalid plates', () => {
    expect(validatePlate('ABCDEFG')).toBe(false);
    expect(validatePlate('1234567')).toBe(false);
    expect(validatePlate('AB12345')).toBe(false);
    expect(validatePlate('A')).toBe(false);
  });
});
