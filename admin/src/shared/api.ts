import type { AnyRecord } from './types';
import { withBrowserSessionLock, subscribeBrowserLogout, broadcastBrowserLogout } from '../../../shared/browser-session-lock';

const TOKEN_REFRESH_LEAD_MS = 30_000;
const adminAuthChangedListeners = new Set<() => void>();

let adminAccessToken: string | null = null;
let userAccessToken: string | null = null;
let adminRefreshPromise: Promise<string | null> | null = null;
let userRefreshPromise: Promise<string | null> | null = null;
let adminRefreshTimer: ReturnType<typeof setTimeout> | null = null;
let userRefreshTimer: ReturnType<typeof setTimeout> | null = null;
const generations = { user: 0, admin: 0 };
const refreshGenerations = { user: -1, admin: -1 };
const stopped = { user: false, admin: false };
subscribeBrowserLogout(getApiBaseUrl(), mode => { stopped[mode] = true; generations[mode]++; clearToken(mode); });
async function sessionLock<T>(mode: 'user' | 'admin', action: () => Promise<T>): Promise<T> {
  return withBrowserSessionLock(getApiBaseUrl(), mode, action);
}
const authChannel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('lsr-auth');
if (authChannel) authChannel.onmessage = event => {
  if (event.data === 'admin-logout') { stopped.admin = true; generations.admin++; clearAdminToken(); }
  if (event.data === 'user-logout') { stopped.user = true; generations.user++; clearUserToken(); }
};

try {
  localStorage.removeItem('sim-race-admin-token');
  localStorage.removeItem('sim-race-user-token');
} catch {
  // Persistent bearer tokens are deliberately retired.
}

export class ApiError extends Error {
  status: number;
  bodyText?: string;

  constructor(message: string, status: number, bodyText?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.bodyText = bodyText;
  }
}

export function getApiBaseUrl() {
  const value = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  return String(value).replace(/\/$/, '');
}

export function getContentAssetUrl(assetId: string | null | undefined, fallbackUrl = '') {
  const normalizedAssetId = String(assetId ?? '').trim();
  return normalizedAssetId
    ? `${getApiBaseUrl()}/content-assets/${encodeURIComponent(normalizedAssetId)}/file`
    : fallbackUrl;
}

export function getCatalogImageUrl(
  catalogItemId: string | null | undefined,
  assetId: string | null | undefined,
  fallbackUrl = '',
) {
  void catalogItemId;
  return getContentAssetUrl(assetId, fallbackUrl);
}

export function getAdminToken() {
  if (adminAccessToken && isTokenExpired(adminAccessToken)) clearAdminToken();
  return adminAccessToken;
}

export function setAdminToken(token: string) {
  generations.admin++;
  stopped.admin = false;
  adminAccessToken = token;
  scheduleTokenRefresh('admin', token);
  notifyAdminAuthChanged();
}

export function clearAdminToken() {
  generations.admin++;
  const changed = adminAccessToken !== null;
  adminAccessToken = null;
  clearTokenRefreshTimer('admin');
  if (changed) notifyAdminAuthChanged();
}

export function subscribeAdminAuthChanged(callback: () => void) {
  adminAuthChangedListeners.add(callback);
  return () => { adminAuthChangedListeners.delete(callback); };
}

function notifyAdminAuthChanged() {
  adminAuthChangedListeners.forEach((callback) => callback());
}

export function getUserToken() {
  if (userAccessToken && isTokenExpired(userAccessToken)) clearUserToken();
  return userAccessToken;
}

export function setUserToken(token: string) {
  generations.user++;
  stopped.user = false;
  userAccessToken = token;
  scheduleTokenRefresh('user', token);
}

export function clearTokens() {
  clearAdminToken();
  clearUserToken();
}

export async function initializeAuthSessions() {
  await Promise.all([refreshToken('user'), refreshToken('admin')]);
}

export async function exchangeSteamCode(code: string) {
  return sessionLock('user', async () => {
  const response = await fetch(`${getApiBaseUrl()}/auth/exchange`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  if (!response.ok) throw new Error('Не удалось завершить вход через Steam.');
  const payload = await response.json() as { accessToken: string };
  setUserToken(payload.accessToken);
  return payload;
  });
}

export async function logoutSessions() {
  stopped.admin = true;
  generations.admin++;
  clearAdminToken();
  authChannel?.postMessage('admin-logout');
  await sessionLock('admin', async () => {
    await broadcastBrowserLogout(getApiBaseUrl(), 'admin');
    const response = await fetch(`${getApiBaseUrl()}/admin/auth/logout`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: '{}' });
    if (!response.ok) throw new Error('Не удалось завершить сессию. Повторите выход.');
  });
}
export async function loginAdmin(adminPassword: string): Promise<{ accessToken: string }> {
  return sessionLock('admin', async () => {
    const result = await apiFetch<{ accessToken: string }>('/admin/auth/login', jsonBody({ adminPassword }), 'user');
    setAdminToken(result.accessToken);
    return result;
  });
}

async function refreshToken(mode: 'admin' | 'user'): Promise<string | null> {
  if (stopped[mode]) return null;
  const generation = generations[mode];
  const currentPromise = mode === 'admin' ? adminRefreshPromise : userRefreshPromise;
  if (currentPromise && refreshGenerations[mode] === generation) return currentPromise;
  refreshGenerations[mode] = generation;
  const path = mode === 'admin' ? '/admin/auth/refresh' : '/auth/refresh';
  const pending = sessionLock(mode, async () => {
    if (stopped[mode] || generation !== generations[mode]) return null;
    return fetch(`${getApiBaseUrl()}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  }).then(async (response) => {
    if (stopped[mode] || generation !== generations[mode]) return null;
    if (!response.ok) {
      clearToken(mode);
      return null;
    }
    const payload = await response.json() as { accessToken: string };
    if (stopped[mode] || generation !== generations[mode]) return null;
    if (mode === 'admin') setAdminToken(payload.accessToken);
    else setUserToken(payload.accessToken);
    return payload.accessToken;
  });
  }).catch(() => {
    if (generation === generations[mode]) clearToken(mode);
    return null;
  }).finally(() => {
    if (mode === 'admin' && adminRefreshPromise === pending) adminRefreshPromise = null;
    else if (mode === 'user' && userRefreshPromise === pending) userRefreshPromise = null;
  });
  if (mode === 'admin') adminRefreshPromise = pending;
  else userRefreshPromise = pending;
  return pending;
}

function clearUserToken() {
  generations.user++;
  userAccessToken = null;
  clearTokenRefreshTimer('user');
}

function clearToken(mode: 'admin' | 'user') {
  if (mode === 'admin') clearAdminToken();
  else clearUserToken();
}

function scheduleTokenRefresh(mode: 'admin' | 'user', token: string) {
  clearTokenRefreshTimer(mode);
  const expiresAt = decodeJwtPayload<{ exp?: number }>(token)?.exp;
  if (typeof expiresAt !== 'number') return;
  const delay = Math.max(0, expiresAt * 1000 - Date.now() - TOKEN_REFRESH_LEAD_MS);
  const timer = globalThis.setTimeout(() => {
    if (mode === 'admin') adminRefreshTimer = null;
    else userRefreshTimer = null;
    void refreshToken(mode);
  }, delay);
  if (mode === 'admin') adminRefreshTimer = timer;
  else userRefreshTimer = timer;
}

function clearTokenRefreshTimer(mode: 'admin' | 'user') {
  const timer = mode === 'admin' ? adminRefreshTimer : userRefreshTimer;
  if (timer !== null) globalThis.clearTimeout(timer);
  if (mode === 'admin') adminRefreshTimer = null;
  else userRefreshTimer = null;
}

function isTokenExpired(token: string) {
  const expiresAt = decodeJwtPayload<{ exp?: number }>(token)?.exp;
  return typeof expiresAt === 'number' && expiresAt * 1000 <= Date.now() + 5_000;
}

export function decodeJwtPayload<T extends AnyRecord>(token: string | null): T | null {
  if (!token) return null;
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;
    const binary = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return JSON.parse(new TextDecoder('utf-8').decode(bytes)) as T;
  } catch {
    return null;
  }
}

export function parseApiErrorMessage(bodyText: string) {
  try {
    const parsed = JSON.parse(bodyText) as { message?: unknown; error?: unknown };
    if (Array.isArray(parsed.message)) return parsed.message.join('; ');
    if (typeof parsed.message === 'string') return parsed.message;
    if (typeof parsed.error === 'string') return parsed.error;
    if (parsed.error && typeof parsed.error === 'object') {
      const error = parsed.error as { code?: unknown; message?: unknown; details?: unknown };
      const message = typeof error.message === 'string' ? error.message : '';
      const code = typeof error.code === 'string' ? error.code : '';
      if (code === 'content_asset_storage_not_configured') {
        return 'Хранилище файлов не настроено. Фото не сохранено: настрой S3-переменные MEDIA_STORAGE_* на backend и попробуй загрузить снова.';
      }
      if (code === 'scenario_config_invalid') {
        return formatScenarioConfigError(error.details);
      }
      if (message && code) return `${message} (${code})`;
      if (message) return message;
      if (code) return code;
    }
  } catch {
    return bodyText;
  }
  return bodyText;
}

function formatScenarioConfigError(details: unknown): string {
  const value = isRecord(details) ? details : {};
  const field = typeof value.field === 'string' ? value.field : '';
  const reason = typeof value.reason === 'string' ? value.reason : '';
  const fieldLabel = scenarioFieldLabel(field);
  const reasonLabel = scenarioReasonLabel(reason, value);
  if (fieldLabel && reasonLabel) return `Некорректная конфигурация: ${fieldLabel} — ${reasonLabel}.`;
  if (fieldLabel) return `Некорректная конфигурация: проверьте поле «${fieldLabel}».`;
  return 'Некорректная конфигурация сценария. Проверьте обязательные поля и расписание.';
}

function scenarioFieldLabel(field: string): string {
  const championshipRound = field.match(/^championshipRounds\.(\d+)\.(.+)$/);
  if (championshipRound) {
    const round = Number(championshipRound[1]) + 1;
    return `${scenarioFieldLabel(championshipRound[2]) || championshipRound[2]} этапа ${round}`;
  }
  const weeklyRound = field.match(/^weeklySchedule\.rounds\.(\d+)\.(.+)$/);
  if (weeklyRound) {
    const round = Number(weeklyRound[1]) + 1;
    return `${scenarioFieldLabel(weeklyRound[2]) || weeklyRound[2]} недели ${round}`;
  }
  const labels: Record<string, string> = {
    championshipStartDate: 'дата начала чемпионата',
    championshipRounds: 'этапы чемпионата',
    startsAt: 'дата и время гонки',
    durationDays: 'длительность этапа',
    trackCode: 'трасса',
    carClassCode: 'набор машин',
    maxParticipants: 'максимальное количество участников',
    maxPlayersPerSession: 'участников в одном сплите',
    maxSessions: 'максимальное количество сплитов',
    raceFormat: 'формат гонки',
    reverseGridPositions: 'количество реверсируемых позиций',
    raceDurationMinutes: 'длительность гонки',
    raceLaps: 'количество кругов',
    practiceDurationMinutes: 'длительность практики',
    qualifyingDurationMinutes: 'длительность квалификации',
    registrationOpensAt: 'начало регистрации',
    registrationClosesAt: 'окончание регистрации',
    registrationCloseBeforeMinutes: 'закрытие регистрации до старта',
    'weeklySchedule.startDate': 'дата начала Weekly',
    'weeklySchedule.rounds': 'недели Weekly',
    'weeklySchedule.dayTimes': 'дни и время гонок',
    timezone: 'часовой пояс события',
  };
  return labels[field] ?? field;
}

function scenarioReasonLabel(reason: string, details: Record<string, unknown>): string {
  if (reason === 'outside_round_period') {
    const start = shortIsoDate(details.periodStartDate);
    const end = shortIsoDate(details.periodEndDate);
    return start && end
      ? `должна находиться в периоде этапа ${start}–${end}`
      : 'должна находиться внутри периода этапа';
  }
  if (reason === 'capacity_exceeded') {
    const participants = finiteNumber(details.maxParticipants);
    const perSession = finiteNumber(details.maxPlayersPerSession);
    const sessions = finiteNumber(details.maxSessions);
    return participants !== null && perSession !== null && sessions !== null
      ? `${participants} участников не помещаются в ${sessions} сплит(а) по ${perSession} человек`
      : 'участники не помещаются в заданное количество сплитов';
  }
  if (reason === 'integer_range' || reason === 'number_range') {
    const min = finiteNumber(details.min);
    const max = finiteNumber(details.max);
    return min !== null && max !== null
      ? `допустимое значение от ${min} до ${max}`
      : 'число находится вне допустимого диапазона';
  }
  if (reason === 'unsupported_value') {
    const values = Array.isArray(details.values) ? details.values.join(', ') : '';
    return values ? `допустимые значения: ${values}` : 'выбрано неподдерживаемое значение';
  }
  const labels: Record<string, string> = {
    required_date: 'укажите дату и время',
    yyyy_mm_dd: 'укажите дату в формате ДД.ММ.ГГГГ',
    valid_date: 'укажите существующую дату',
    datetime_string: 'укажите корректные дату и время',
    required_string: 'поле обязательно',
    optional_string: 'значение должно быть текстом',
    boolean: 'значение должно быть переключателем',
    flag_0_or_1: 'допустимы только значения 0 или 1',
    assist_mode_0_1_2: 'допустимы только значения 0, 1 или 2',
    object: 'настройки заполнены некорректно',
    optional_object: 'настройки заполнены некорректно',
    object_array: 'должен быть список настроек',
    non_empty_object_array: 'добавьте хотя бы один элемент',
    weekday_time_array: 'дни и время заполнены некорректно',
    hh_mm: 'время должно быть в формате ЧЧ:ММ',
    at_least_one_time: 'добавьте хотя бы одно время гонки',
    reverse_grid_requires_assetto_corsa: 'реверсивная решётка доступна только для Assetto Corsa',
    reverse_grid_positive_required: 'укажите хотя бы одну реверсируемую позицию',
    rating_license: 'выберите допустимый класс лицензии',
    invalid_timezone: 'укажите корректный часовой пояс',
  };
  return labels[reason] ?? reason;
}

function shortIsoDate(value: unknown): string {
  if (typeof value !== 'string') return '';
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : value;
}

function finiteNumber(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

const activeReads=new Set<Promise<unknown>>();
const referenceReads=new Map<string,{until:number;promise:Promise<unknown>}>();
/** Short-lived reference data only. Personal histories and live state never enter this cache. */
export function invalidateReferenceCache(){referenceReads.clear();}
subscribeAdminAuthChanged(invalidateReferenceCache);
/** A socket snapshot follows reads already started before its invalidation, closing the initial-read race. */
export async function settlePendingReads(){await Promise.allSettled([...activeReads]);}
export function apiFetch<T>(path:string,init:RequestInit={},tokenMode:'admin'|'user'|'none'='admin'):Promise<T>{
 const method=(init.method??'GET').toUpperCase();
 if(method!=='GET'&&method!=='HEAD')invalidateReferenceCache();
 const cachedReference=Object.keys(init).length===0&&(/^\/games\/[^/]+\/cars$/.test(path)||/^\/admin\/catalog\/(car-brands|official-dlcs)$/.test(path));
 const key=tokenMode+':'+(tokenMode==='admin'?getAdminToken():tokenMode==='user'?getUserToken():'')+':'+path,cached=cachedReference?referenceReads.get(key):undefined;
 if(cached&&cached.until>Date.now())return cached.promise.then(value=>structuredClone(value) as T);
 const promise=performApiFetch<T>(path,init,tokenMode);if(method==='GET'){activeReads.add(promise);void promise.then(()=>activeReads.delete(promise),()=>activeReads.delete(promise));}
 if(cachedReference){if(referenceReads.size>=32)referenceReads.clear();referenceReads.set(key,{until:Date.now()+60000,promise});void promise.catch(()=>{if(referenceReads.get(key)?.promise===promise)referenceReads.delete(key);});return promise.then(value=>structuredClone(value));}
 return promise;
}
async function performApiFetch<T>(path: string, init: RequestInit = {}, tokenMode: 'admin' | 'user' | 'none' = 'admin') {
  const headers = new Headers(init.headers);
  if (/^\/(admin\/(catalog|publications|content-upload-sessions|content-assets)|skins\/admin)(\/|$)/.test(path) && !['GET', 'HEAD'].includes((init.method ?? 'GET').toUpperCase()) && !headers.has('Idempotency-Key')) headers.set('Idempotency-Key', crypto.randomUUID());
  const hasBody = init.body !== undefined;
  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
  if (hasBody && !isFormData && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  let token = tokenMode === 'admin' ? getAdminToken() : tokenMode === 'user' ? getUserToken() : null;
  if (!token && tokenMode !== 'none') token = await refreshToken(tokenMode);
  const sessionKey=(value:string|null)=>{const payload=decodeJwtPayload(value);return payload?JSON.stringify([payload.sub,payload.sid]):value;};
  const originalSession=sessionKey(token),currentSession=()=>sessionKey(tokenMode==='admin'?getAdminToken():tokenMode==='user'?getUserToken():null);
  if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);

  let response = await fetch(`${getApiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`, {
    ...init,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    const authMutation = /\/auth\/(login|bootstrap|refresh|logout|exchange)(?:\/|$)/.test(path);
    if (response.status === 401 && tokenMode !== 'none' && !authMutation && currentSession()===originalSession) {
      const refreshed = await refreshToken(tokenMode);
      if (refreshed && refreshed !== token && sessionKey(refreshed)===originalSession) {
        const retryHeaders = new Headers(headers);
        if (hasBody && !isFormData && !retryHeaders.has('Content-Type')) retryHeaders.set('Content-Type', 'application/json');
        retryHeaders.set('Authorization', `Bearer ${refreshed}`);
        response = await fetch(`${getApiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`, {
          ...init,
          headers: retryHeaders,
          credentials: 'include',
        });
      }
    }
    if(!response.ok){const bodyText = await response.text().catch(() => '');
    if (response.status === 401 && tokenMode !== 'none' && currentSession()===originalSession) clearToken(tokenMode);
    throw new ApiError(parseApiErrorMessage(bodyText), response.status, bodyText);}
  }

  if(tokenMode!=='none' && currentSession()!==originalSession)throw new ApiError('Сессия изменилась',401);
  if (response.status === 204) return undefined as T;
  const value=await response.json() as T;
  if(tokenMode!=='none' && currentSession()!==originalSession)throw new ApiError('Сессия изменилась',401);
  return value;
}

export async function apiDownload(path: string, fallbackFileName: string, tokenMode: 'admin' | 'user' | 'none' = 'admin') {
  const headers = new Headers();
  let token = tokenMode === 'admin' ? getAdminToken() : tokenMode === 'user' ? getUserToken() : null;
  if (!token && tokenMode !== 'none') token = await refreshToken(tokenMode);
  const originalToken = token;
  const currentToken = () => tokenMode === 'admin' ? getAdminToken() : tokenMode === 'user' ? getUserToken() : null;
  if (token) headers.set('Authorization', `Bearer ${token}`);
  let response = await fetch(`${getApiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`, { headers, credentials: 'include' });
  if (response.status === 401 && tokenMode !== 'none' && currentToken() === originalToken) {
    token = await refreshToken(tokenMode);
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
      response = await fetch(`${getApiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`, { headers, credentials: 'include' });
    }
  }
  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    if (response.status === 401 && tokenMode !== 'none' && currentToken()===token) clearToken(tokenMode);
    throw new ApiError(parseApiErrorMessage(bodyText), response.status, bodyText);
  }
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const encodedName = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const plainName = disposition.match(/filename="?([^";]+)"?/i)?.[1];
  return {
    blob: await response.blob(),
    fileName: encodedName ? decodeURIComponent(encodedName) : plainName || fallbackFileName,
  };
}

export async function apiUploadFormData<T>(path: string, body: FormData, onProgress?: (progress: { loaded: number; total: number; percent: number | null }) => void) {
  const initialToken = getAdminToken() ?? await refreshToken('admin');
  return uploadWithToken<T>(path, body, initialToken, onProgress, true);
}

function uploadWithToken<T>(
  path: string,
  body: FormData,
  token: string | null,
  onProgress: ((progress: { loaded: number; total: number; percent: number | null }) => void) | undefined,
  allowRefresh: boolean,
  commandId = crypto.randomUUID(),
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${getApiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`);
    xhr.withCredentials = true;
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('Idempotency-Key', commandId);
    xhr.upload.onprogress = (event) => {
      if (!onProgress) return;
      onProgress({
        loaded: event.loaded,
        total: event.lengthComputable ? event.total : 0,
        percent: event.lengthComputable && event.total > 0 ? Math.round((event.loaded / event.total) * 100) : null,
      });
    };
    xhr.onload = async () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.responseText ? JSON.parse(xhr.responseText) as T : undefined as T);
        return;
      }
      if (xhr.status === 401 && allowRefresh) {
        const refreshed = await refreshToken('admin');
        if (refreshed) {
          uploadWithToken<T>(path, body, refreshed, onProgress, false, commandId).then(resolve, reject);
          return;
        }
      }
      if (xhr.status === 401) clearAdminToken();
      reject(new ApiError(parseApiErrorMessage(xhr.responseText || xhr.statusText), xhr.status, xhr.responseText));
    };
    xhr.onerror = () => reject(new ApiError('Failed to upload file', xhr.status || 0));
    xhr.send(body);
  });
}

export function jsonBody(value: unknown): RequestInit {
  return { method: 'POST', body: JSON.stringify(value) };
}

export function putJsonBody(value: unknown): RequestInit {
  return { method: 'PUT', body: JSON.stringify(value) };
}

export function patchJsonBody(value: unknown): RequestInit {
  return { method: 'PATCH', body: JSON.stringify(value) };
}
