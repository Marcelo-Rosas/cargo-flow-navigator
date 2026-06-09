/** Embarcador adicional na cotação (campo JSON `quotes.additional_shippers`). */
export interface QuoteAdditionalShipper {
  shipper_id?: string;
  name: string;
  email?: string;
  /** CEP do ponto de coleta — pode diferir do cadastro do embarcador. */
  cep?: string;
  city_uf?: string;
}

export function parseQuoteAdditionalShippers(value: unknown): QuoteAdditionalShipper[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => item != null && typeof item === 'object')
    .map((item) => ({
      shipper_id: typeof item.shipper_id === 'string' ? item.shipper_id : undefined,
      name: typeof item.name === 'string' ? item.name : '',
      email: typeof item.email === 'string' ? item.email : undefined,
      cep: typeof item.cep === 'string' ? item.cep : undefined,
      city_uf: typeof item.city_uf === 'string' ? item.city_uf : undefined,
    }))
    .filter((item) => item.name.trim().length > 0);
}
