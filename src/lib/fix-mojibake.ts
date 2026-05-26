/** Corrige texto salvo como Latin-1 interpretado como UTF-8 (ex.: SÃ£o → São). */
const MOJIBAKE_RX = /Ã.|â€|Â./;

export function fixMojibake(value: string | null | undefined): string {
  if (value == null) return '';
  const trimmed = value.trim();
  if (!trimmed || !MOJIBAKE_RX.test(trimmed)) return trimmed;
  try {
    return decodeURIComponent(escape(trimmed));
  } catch {
    return trimmed
      .replace(/Ã£/g, 'ã')
      .replace(/Ã¡/g, 'á')
      .replace(/Ã©/g, 'é')
      .replace(/Ã§/g, 'ç')
      .replace(/Ã³/g, 'ó')
      .replace(/Ãº/g, 'ú')
      .replace(/Ã/g, 'Á')
      .replace(/â€"/g, '–')
      .replace(/â€“/g, '–');
  }
}
