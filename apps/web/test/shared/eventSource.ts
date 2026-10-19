type Listener = (event: MessageEvent) => void;

export class FakeEventSource {
  static instances: FakeEventSource[] = [];

  readyState = 0;
  closed = false;
  onerror: ((event: Event) => void) | null = null;
  private readonly listeners = new Map<string, Listener[]>();

  constructor(readonly url: string, readonly init?: EventSourceInit) {
    FakeEventSource.instances.push(this);
  }

  static latest(): FakeEventSource {
    const source = FakeEventSource.instances.at(-1);
    if (!source) throw new Error("No event source was opened");
    return source;
  }

  static reset(): void {
    FakeEventSource.instances = [];
  }

  addEventListener(type: string, listener: Listener): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  emit(type: string, data: unknown): void {
    this.readyState = 1;
    const event = new MessageEvent(type, { data: typeof data === "string" ? data : JSON.stringify(data) });
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }

  drop(): void {
    this.readyState = 0;
    this.onerror?.(new Event("error"));
  }

  fail(): void {
    this.readyState = 2;
    this.onerror?.(new Event("error"));
  }

  close(): void {
    this.readyState = 2;
    this.closed = true;
  }
}

export const fakeEventSource = (url: string) => new FakeEventSource(url) as unknown as EventSource;
