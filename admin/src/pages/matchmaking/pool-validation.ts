import type { Pools } from './PoolFields';

/** Early, human-readable feedback; catalog availability is still validated by the server. */
export function poolErrors(p: Pools | undefined): string[] {
  if (!p) return ['Преобразуйте сохранённые условия в пулы.'];
  const errors: string[] = [];
  const positive = (n: number, max: number) => Number.isFinite(n) && n > 0 && n <= max;
  if (!p.carIds.length) errors.push('Добавьте машины в общий пул.');
  if (![2, 3, 4, 'all'].includes(p.offerCount)) errors.push('Выберите 2, 3, 4 или все машины.');
  if (!Number.isInteger(p.readyTimeoutSeconds) || p.readyTimeoutSeconds < 120 || p.readyTimeoutSeconds > 3600) errors.push('Время на готовность: от 120 до 3600 секунд.');
  if (!p.tracks.some(t => t.enabled)) errors.push('Включите хотя бы одну трассу.');
  if (!p.weather.some(w => w.enabled)) errors.push('Добавьте и включите погоду.');
  const locations = new Set<string>();
  for (const [i, t] of p.tracks.entries()) {
    const name = `Трасса ${i + 1} (${t.title})`;
    const location = JSON.stringify([t.code, t.layoutCode ?? '']);
    if (!t.code || !t.title.trim()) errors.push(`${name}: выберите трассу.`);
    if (locations.has(location)) errors.push(`${name}: конфигурация трассы повторяется.`);
    locations.add(location);
    if (!positive(t.weight, 1_000_000)) errors.push(`${name}: вес должен быть больше 0 и не больше 1 000 000.`);
    if (!Number.isInteger(t.durationMinutes) || !positive(t.durationMinutes, 240)) errors.push(`${name}: длительность от 1 до 240 целых минут.`);
    if (!t.carIds.length || p.offerCount !== 'all' && t.carIds.length < p.offerCount) errors.push(`${name}: недостаточно машин для выбранного предложения.`);
    if (t.carIds.some(id => !p.carIds.includes(id))) errors.push(`${name}: подпул содержит машины вне общего пула.`);
    if (!t.weatherKeys.length || t.weatherKeys.some(key => !p.weather.some(w => w.key === key)) || t.enabled && !p.weather.some(w => w.enabled && t.weatherKeys.includes(w.key))) errors.push(`${name}: выберите доступную погоду.`);
  }
  for (const [i, w] of p.weather.entries()) {
    if (!w.title.trim() || !w.codes.length || w.codes.some(code => !code)) errors.push(`Погода ${i + 1}: заполните название и пресет.`);
    if (!positive(w.weight, 1_000_000)) errors.push(`Погода ${i + 1}: вес должен быть больше 0 и не больше 1 000 000.`);
  }
  return errors;
}
