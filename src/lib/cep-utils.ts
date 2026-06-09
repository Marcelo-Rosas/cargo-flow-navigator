/** Cidade - UF para campos de rota (padrão TMS / WebRouter). */
export function formatCityUfFromCep(data: { localidade: string; uf: string }): string {
  const city = (data.localidade ?? '').trim();
  const uf = (data.uf ?? '').trim().toUpperCase();
  if (!city && !uf) return '';
  if (!uf) return city;
  return `${city} - ${uf}`;
}

export function sanitizeCep(value: string): string {
  return value.replace(/\D/g, '').slice(0, 8);
}
