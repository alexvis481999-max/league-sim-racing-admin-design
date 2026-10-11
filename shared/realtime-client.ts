export type RealtimeEnvelope = {
  id: string;
  version: number;
  type: string;
  channel: string;
  occurredAt: string;
  serverNow?: string;
  cursor?: string;
  payload: Record<string, unknown>;
};
type Listener = (message: RealtimeEnvelope) => void;
/** One connection per application. Reconnect always requests an explicit snapshot, never HTTP polling. */
export class RealtimeClient {
  private activeChannels = new Set<string>();
  private socket: WebSocket | null = null;
  private topics = new Map<string, Set<Listener>>();
  private states = new Set<() => void>();
  private connected = false;
  private generation = 0;
  private attempt = 0;
  private subscription = 0;
  private version = 0;
  private retry?: ReturnType<typeof setTimeout>;
  private subscribeTimer?: ReturnType<typeof setTimeout>;
  private watchdog?: ReturnType<typeof setTimeout>;
  private heartbeat?: ReturnType<typeof setInterval>;
  constructor(
    private readonly options: {
      url: () => string;
      token: () => string | null;
      mode: 'user' | 'admin';
      invalidate?: () => void;
      unauthorized?: () => void;
      socket?: (url: string) => WebSocket;
    },
  ) {}
  status = () => this.connected;
  observe = (fn: () => void) => {
    this.states.add(fn);
    return () => {
      this.states.delete(fn);
    };
  };
  subscribe(channel: string, listener: Listener) {
    let set = this.topics.get(channel);
    const added = !set;
    if (!set) {
      set = new Set();
      this.topics.set(channel, set);
    }
    set.add(listener);
    this.ensure();
    if (added) this.resubscribe();
    else if (this.connected && this.activeChannels.has(channel)) {
      const generation = this.generation;
      // Only the new consumer needs a snapshot; resubscribing all listeners can create render/refetch loops.
      queueMicrotask(() => {
        if (generation !== this.generation || !set!.has(listener)) return;
        this.options.invalidate?.();
        try {
          listener({
            id: `snapshot:${generation}:${this.version}`,
            version: this.version,
            type: 'realtime.resync',
            channel,
            occurredAt: new Date().toISOString(),
            payload: { reason: 'new_consumer' },
          });
        } catch {
          /* isolate subscriber */
        }
      });
    }
    return () => {
      set!.delete(listener);
      if (!set!.size) {
        this.topics.delete(channel);
        if (!this.topics.size) this.stop();
        else this.resubscribe();
      }
    };
  }
  reset = () => {
    this.stop();
    if (this.topics.size) this.ensure();
  };
  private state(value: boolean) {
    if (value === this.connected) return;
    this.connected = value;
    this.states.forEach((fn) => fn());
  }
  private stop() {
    this.generation++;
    clearTimeout(this.retry);
    clearTimeout(this.subscribeTimer);
    clearTimeout(this.watchdog);
    clearInterval(this.heartbeat);
    const socket = this.socket;
    this.socket = null;
    socket?.close();
    this.state(false);
  }
  private ensure() {
    if (this.socket || (!this.options.socket && typeof WebSocket === 'undefined')) return;
    const generation = ++this.generation;
    const socket = (this.socket = (this.options.socket ?? ((url) => new WebSocket(url)))(
      this.options.url(),
    ));
    this.version = 0;
    const current = () => this.socket === socket && this.generation === generation;
    this.watchdog = setTimeout(() => {
      if (current()) socket.close();
    }, 15000);
    socket.addEventListener('open', () => {
      if (!current()) return;
      this.resubscribe();
      this.heartbeat = setInterval(() => {
        if (current()) {
          socket.send(JSON.stringify({ type: 'realtime.ping' }));
          clearTimeout(this.watchdog);
          this.watchdog = setTimeout(() => socket.close(), 10000);
        }
      }, 25000);
    });
    socket.addEventListener('message', (event) => {
      if (!current()) return;
      let message: RealtimeEnvelope & { subscription?: number };
      try {
        message = JSON.parse(String(event.data));
      } catch {
        socket.close();
        return;
      }
      if (
        !Number.isSafeInteger(message.version) ||
        message.version < 1 ||
        typeof message.type !== 'string'
      ) {
        socket.close();
        return;
      }
      if (message.version <= this.version) return;
      if (message.version !== this.version + 1) {
        socket.close();
        return;
      }
      this.version = message.version;
      if (message.type === 'realtime.pong') {
        clearTimeout(this.watchdog);
        return;
      }
      if (message.type === 'realtime.resync') {
        if (message.subscription !== this.subscription) return;
        clearTimeout(this.watchdog);
        this.attempt = 0;
        this.state(true);
        this.options.invalidate?.();
        for (const [channel, listeners] of this.topics)
          if (this.activeChannels.has(channel))
            for (const listener of listeners) {
              try {
                listener({ ...message, channel });
              } catch {
                /* isolate subscribers */
              }
            }
        return;
      }
      if (!['realtime.invalidate', 'runtime.snapshot'].includes(message.type) || !this.connected) return;
      if (
        typeof message.channel !== 'string' ||
        !message.payload ||
        typeof message.payload !== 'object'
      ) {
        socket.close();
        return;
      }
      if (message.type === 'realtime.invalidate') this.options.invalidate?.();
      const channel = message.channel.startsWith('user:') ? 'user:self' : message.channel;
      for (const listener of this.topics.get(channel) ?? []) {
        try {
          listener(message);
        } catch {
          /* isolate subscribers */
        }
      }
    });
    socket.addEventListener('error', () => {
      if (current()) socket.close();
    });
    socket.addEventListener('close', (event) => {
      if (!current()) return;
      if ((event as CloseEvent).code === 4401 || (event as CloseEvent).code === 4403) {
        this.stop();
        this.options.unauthorized?.();
        return;
      }
      this.socket = null;
      this.state(false);
      clearTimeout(this.watchdog);
      clearInterval(this.heartbeat);
      if (this.topics.size)
        this.retry = setTimeout(
          () => this.ensure(),
          Math.min(15000, 500 * 2 ** Math.min(this.attempt++, 5)) + Math.floor(Math.random() * 250),
        );
    });
  }
  private resubscribe() {
    clearTimeout(this.subscribeTimer);
    this.subscribeTimer = setTimeout(() => {
      const socket = this.socket;
      if (!socket || socket.readyState !== 1) return;
      const token = this.options.token();
      const channels = [...this.topics.keys()].filter((c) => c.startsWith('public:') || !!token);
      this.activeChannels = new Set(channels);
      socket.send(
        JSON.stringify({
          type: 'realtime.subscribe',
          mode: this.options.mode,
          accessToken: token,
          channels,
          subscription: ++this.subscription,
        }),
      );
    }, 20);
  }
}
export function realtimeUrl(api: string, explicit?: string) {
  const url = new URL(
    explicit || api,
    typeof location === 'undefined' ? 'http://localhost' : location.href,
  );
  url.protocol = url.protocol === 'https:' || url.protocol === 'wss:' ? 'wss:' : 'ws:';
  url.pathname = '/realtime';
  url.search = '';
  url.hash = '';
  return url.toString();
}
