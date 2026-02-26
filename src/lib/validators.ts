/**
 * Validadores brasileiros centralizados
 * Usados nos schemas Zod de todos os formulários
 */
import { z } from 'zod';

// ─── Helpers internos ─────────────────────────────────────────────────────────

/** Remove tudo que não for dígito */
const digits = (v: string) => v.replace(/\D/g, '');

// ─── CPF ──────────────────────────────────────────────────────────────────────

export function validateCpf(cpf: string): boolean {
  const n = digits(cpf);
  if (n.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(n)) return false; // todos iguais

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(n[i]) * (10 - i);
  let d1 = (sum * 10) % 11;
  if (d1 === 10 || d1 === 11) d1 = 0;
  if (d1 !== parseInt(n[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(n[i]) * (11 - i);
  let d2 = (sum * 10) % 11;
  if (d2 === 10 || d2 === 11) d2 = 0;
  return d2 === parseInt(n[10]);
}

// ─── CNPJ ─────────────────────────────────────────────────────────────────────

export function validateCnpj(cnpj: string): boolean {
  const n = digits(cnpj);
  if (n.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(n)) return false; // todos iguais

  const calc = (len: number) => {
    let sum = 0;
    let pos = len - 7;
    for (let i = len; i >= 1; i--) {
      sum += parseInt(n[len - i]) * pos--;
      if (pos < 2) pos = 9;
    }
    return sum % 11 < 2 ? 0 : 11 - (sum % 11);
  };

  return calc(12) === parseInt(n[12]) && calc(13) === parseInt(n[13]);
}

// ─── CPF ou CNPJ ──────────────────────────────────────────────────────────────

export function validateCpfOrCnpj(value: string): boolean {
  const n = digits(value);
  if (n.length === 11) return validateCpf(value);
  if (n.length === 14) return validateCnpj(value);
  return false;
}

// ─── Telefone brasileiro ───────────────────────────────────────────────────────
// Aceita fixo (10 dígitos) ou celular (11 dígitos), com ou sem formatação

export function validatePhone(phone: string): boolean {
  const n = digits(phone);
  return n.length === 10 || n.length === 11;
}

// ─── CEP ──────────────────────────────────────────────────────────────────────

export function validateCep(cep: string): boolean {
  const n = digits(cep);
  return n.length === 8;
}

// ─── Placa brasileira ─────────────────────────────────────────────────────────
// Padrão antigo: ABC1234
// Mercosul:      ABC1D23

export function validatePlate(plate: string): boolean {
  const p = plate.trim().toUpperCase().replace(/[-\s]/g, '');
  return /^[A-Z]{3}\d{4}$/.test(p) || /^[A-Z]{3}\d[A-Z]\d{2}$/.test(p);
}

// ─── Schemas Zod reutilizáveis ────────────────────────────────────────────────

/**
 * Campo CPF opcional com validação de formato e dígito verificador.
 * Aceita vazio ("") → null
 */
export const zodCpf = z
  .string()
  .optional()
  .refine((v) => !v || digits(v).length === 0 || validateCpf(v), 'CPF inválido');

/**
 * Campo CNPJ opcional com validação de formato e dígito verificador.
 * Aceita vazio ("") → null
 */
export const zodCnpj = z
  .string()
  .optional()
  .refine((v) => !v || digits(v).length === 0 || validateCnpj(v), 'CNPJ inválido');

/**
 * Campo CPF/CNPJ opcional com validação de formato e dígito verificador.
 * Detecta automaticamente CPF (11) ou CNPJ (14).
 */
export const zodCpfOrCnpj = z
  .string()
  .optional()
  .refine((v) => !v || digits(v).length === 0 || validateCpfOrCnpj(v), 'CPF ou CNPJ inválido');

/**
 * Telefone brasileiro opcional (fixo 10 dígitos ou celular 11 dígitos).
 */
export const zodPhone = z
  .string()
  .optional()
  .refine(
    (v) => !v || digits(v).length === 0 || validatePhone(v),
    'Telefone inválido – informe DDD + número (ex: (11) 99999-9999)'
  );

/**
 * CEP brasileiro opcional (8 dígitos).
 */
export const zodCep = z
  .string()
  .optional()
  .refine(
    (v) => !v || digits(v).length === 0 || validateCep(v),
    'CEP inválido – informe 8 dígitos (ex: 01310-100)'
  );

/**
 * Placa de veículo brasileira obrigatória.
 * Aceita padrão antigo (ABC1234) e Mercosul (ABC1D23).
 */
export const zodPlate = z
  .string()
  .min(1, 'Placa obrigatória')
  .refine(validatePlate, 'Placa inválida – use o formato ABC1234 ou ABC1D23 (Mercosul)');
