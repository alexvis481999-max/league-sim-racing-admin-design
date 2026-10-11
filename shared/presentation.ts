/** Labels describe API values without changing their business meaning. */
export const gameNames: Readonly<Record<string, string>> = {
  assetto_corsa: 'Assetto Corsa',
  assetto_corsa_competizione: 'Assetto Corsa Competizione',
  iracing: 'iRacing',
};
export const disciplineNames: Readonly<Record<string, string>> = {
  circuit: 'Кольцо', circuit_racing: 'Кольцо', touge: 'Тоге', drift: 'Дрифт', rally: 'Ралли',
};
export const eventStatusNames: Readonly<Record<string, string>> = {
  DRAFT: 'Черновик', PUBLISHED: 'Опубликовано', RUNNING: 'Выполняется',
  COMPLETED: 'Завершено', CANCELLED: 'Отменено', FAILED: 'Ошибка',
};
export function displayGame(code: string): string { return gameNames[code] ?? code; }
export function displayDiscipline(code: string): string { return disciplineNames[code] ?? code; }
export function displayEventStatus(code: string): string { return eventStatusNames[code] ?? code; }

/** Display only; never use this function to calculate or serialize a schedule. */
export function displayDateTime(value: string | null | undefined, timezone?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  try {
    return new Intl.DateTimeFormat('ru-RU', { timeZone: timezone, dateStyle: 'medium', timeStyle: 'short' }).format(date);
  } catch { return '—'; }
}

export function displayMatchStatus(code: string): string {
  return ({ READY_CHECK: 'Выбор и готовность', STARTING: 'Подготовка сервера', RUNNING: 'Гонка идёт', FINISHED: 'Завершён', FAILED: 'Ошибка запуска или заезда', CANCELLED: 'Отменён' } as Record<string, string>)[code] ?? code;
}

export function displayRuntimeStatus(code: string): string {
  return ({ UNKNOWN: 'Связь уточняется', IDLE: 'Свободен', AVAILABLE: 'Свободен', RESERVED: 'Зарезервирован', PREPARING: 'Подготовка', STARTING: 'Запуск', RUNNING: 'Работает', STOPPING: 'Остановка', STOPPED: 'Остановлен', FINISHED: 'Завершён', COMPLETED: 'Завершён', FAILED: 'Ошибка', COOLDOWN: 'Ожидание перед запуском', ONLINE: 'На связи', OFFLINE: 'Нет связи', CONNECTED: 'На связи', DISCONNECTED: 'Нет связи', READY: 'Готов', PENDING: 'Ожидание' } as Record<string, string>)[code.toUpperCase()] ?? code;
}
