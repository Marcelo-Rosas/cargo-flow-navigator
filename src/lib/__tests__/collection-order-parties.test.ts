import { describe, expect, it } from 'vitest';
import { parseCityUfLabel, shipperRecordToPartyData } from '@/lib/collection-order-parties';
import { parseQuoteAdditionalShippers } from '@/types/quote-shippers';

describe('collection-order-parties', () => {
  it('parseia city_uf no formato da cotação', () => {
    expect(parseCityUfLabel('São Paulo - SP')).toEqual({
      city: 'São Paulo',
      state: 'SP',
    });
  });

  it('monta remetente 2 com CEP da cotação (COT-2026-06-0004)', () => {
    const additional = parseQuoteAdditionalShippers([
      {
        cep: '04270002',
        name: 'MAKTUB INDUSTRIA COMERCIO E MANUTENCAO LTDA',
        email: 'juliana@maktubfitness.com.br',
        city_uf: 'São Paulo - SP',
        shipper_id: '5399d8ab-e91d-4884-84ba-1f38fe0c010f',
      },
    ]);

    const party = shipperRecordToPartyData(
      {
        name: 'MAKTUB INDUSTRIA COMERCIO E MANUTENCAO LTDA',
        cnpj: '74513243000160',
        phone: '11 971801558',
        address: 'DR. Dr. Mario Vicente, 1248 ',
        city: 'São Paulo - SP',
        state: 'SP',
        zip_code: '04270-002',
      },
      { quoteEntry: additional[0] }
    );

    expect(party?.name).toContain('MAKTUB');
    expect(party?.zip_code).toBe('04270-002');
    expect(party?.city).toBe('São Paulo');
    expect(party?.state).toBe('SP');
    expect(party?.email).toBe('juliana@maktubfitness.com.br');
  });
});
