/** A shared API-origin iframe serializes cookie mutations across site/admin tabs without transferring credentials. */
const frames = new Map<string, Promise<HTMLIFrameElement>>();
const loadedFrames = new Set<HTMLIFrameElement>();
export function subscribeBrowserLogout(base: string, handler: (mode: 'user' | 'admin') => void): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('message', event => {
    if (event.origin === new URL(base).origin && [...loadedFrames].some(frame => frame.contentWindow === event.source)
      && event.data?.type === 'lsr-session-logout' && ['user','admin'].includes(event.data.mode)) handler(event.data.mode);
  });
}
export async function broadcastBrowserLogout(base: string, mode: 'user' | 'admin'): Promise<void> {
  if (typeof document === 'undefined') return;
  const frame = await coordinator(base);
  frame.contentWindow?.postMessage({type:'lsr-session-logout', mode}, new URL(base).origin);
}
function coordinator(base: string): Promise<HTMLIFrameElement> {
  const url = new URL('/auth/session-coordinator', base);
  const key = url.origin;
  const existing = frames.get(key);
  if (existing) return existing;
  const ready = new Promise<HTMLIFrameElement>((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.hidden = true; frame.setAttribute('aria-hidden', 'true'); frame.title = 'Session coordination';
    const timer = setTimeout(() => { frame.remove(); frames.delete(key); reject(new Error('Session coordinator unavailable')); }, 15000);
    frame.onload = () => { clearTimeout(timer); loadedFrames.add(frame); resolve(frame); };
    frame.onerror = () => { clearTimeout(timer); frame.remove(); frames.delete(key); reject(new Error('Session coordinator unavailable')); };
    frame.src = url.toString(); document.body.appendChild(frame);
  });
  frames.set(key, ready);
  return ready;
}
export async function withBrowserSessionLock<T>(base: string, mode: 'user' | 'admin', action: () => Promise<T>): Promise<T> {
  // Non-browser unit tests have no cookie jar to coordinate.
  if (typeof document === 'undefined') return action();
  const frame = await coordinator(base), origin = new URL(base).origin, id = crypto.randomUUID();
  const send = (operation: string) => frame.contentWindow?.postMessage({ type: 'lsr-session-lock', id, mode, action: operation }, origin);
  await new Promise<void>((resolve, reject) => {
    const listener = (event: MessageEvent) => {
      if (event.origin !== origin || event.source !== frame.contentWindow || event.data?.type !== 'lsr-session-lock' || event.data.id !== id) return;
      clearTimeout(timer); window.removeEventListener('message', listener);
      if (event.data.status === 'acquired') resolve();
      else { send('release'); reject(new Error('Browser session coordination unavailable')); }
    };
    const timer = setTimeout(() => { window.removeEventListener('message', listener); send('release'); reject(new Error('Session coordinator timeout')); }, 20000);
    window.addEventListener('message', listener); send('acquire');
  });
  try { return await action(); } finally { send('release'); }
}
