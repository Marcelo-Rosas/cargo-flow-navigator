import { describe, expect, it } from 'vitest';
import { mapEdgeAnttMetaToStored } from '@/lib/map-edge-antt-meta';

describe('mapEdgeAnttMetaToStored', () => {
  it('maps edge snapshot to stored meta.antt', () => {
    const stored = mapEdgeAnttMetaToStored(
      {
        operation_table: 'A',
        cargo_type: 'carga_geral',
        axes_count: 7,
        km_distance: 2848,
        ccd: 7.4902,
        cc: 746.78,
        ida: 22082.11,
        retorno_vazio: 0,
        total: 22082.11,
        composicao_veicular: true,
        alto_desempenho: false,
      },
      '2026-06-09T20:00:00.000Z'
    );

    expect(stored).toMatchObject({
      operationTable: 'A',
      cargoType: 'carga_geral',
      axesCount: 7,
      ccd: 7.4902,
      calculatedAt: '2026-06-09T20:00:00.000Z',
    });
  });

  it('returns undefined when snapshot incomplete', () => {
    expect(mapEdgeAnttMetaToStored(undefined)).toBeUndefined();
    expect(mapEdgeAnttMetaToStored({} as never)).toBeUndefined();
  });
});
