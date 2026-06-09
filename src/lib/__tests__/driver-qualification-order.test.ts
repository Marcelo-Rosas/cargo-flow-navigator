import { describe, expect, it } from 'vitest';
import { normalizePlate } from '@/lib/driver-qualification-order';

describe('driver-qualification-order', () => {
  it('normaliza placa Mercosul', () => {
    expect(normalizePlate('ftp3g91')).toBe('FTP3G91');
    expect(normalizePlate('FTP-3G91')).toBe('FTP3G91');
  });
});
