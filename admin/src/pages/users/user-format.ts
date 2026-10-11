/** Display-only helpers of the pilots section. */
const regions = (() => { try { return new Intl.DisplayNames(['ru'], { type: 'region' }); } catch { return null; } })();

/** ISO country code → Russian name; `unknown`/empty → «—». */
export function countryName(code: string | null | undefined) {
  if (!code || code === 'unknown') return '—';
  try { return regions?.of(code) ?? code; } catch { return code; }
}

export const games: Record<string, string> = { assetto_corsa: 'Assetto Corsa', assetto_corsa_competizione: 'ACC', iracing: 'iRacing' };
export const gameNames = (codes: string[] | undefined) => codes?.length ? codes.map(code => games[code] ?? code).join(', ') : '—';
export const fieldLabels: Record<string, string> = { firstName: 'Имя', lastName: 'Фамилия', shortName: 'Три буквы', country: 'Страна', discord: 'Discord', youtube: 'YouTube' };
