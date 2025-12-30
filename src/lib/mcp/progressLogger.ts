export type LogLevel =
  | "debug"
  | "info"
  | "notice"
  | "warning"
  | "error"
  | "critical"
  | "alert"
  | "emergency";

export type LogFn = (level: LogLevel, message: string) => Promise<void>;

export type CodexExecEventSummary = {
  type?: string;
  item_type?: string;
  item_status?: string;
};

export function createThrottledCodexExecProgressLogger(options: {
  log: LogFn;
  label: string;
  heartbeatMs?: number;
  eventThrottleMs?: number;
}): {
  start: () => void;
  stop: () => void;
  onEvent: (event: CodexExecEventSummary) => void;
} {
  const heartbeatMs = options.heartbeatMs ?? 10_000;
  const eventThrottleMs = options.eventThrottleMs ?? 1_000;

  const startedAt = Date.now();
  let timer: NodeJS.Timeout | null = null;

  let lastEventType: string | null = null;
  let lastItemType: string | null = null;

  const counts = new Map<string, number>();
  const bump = (key: string): void => {
    counts.set(key, (counts.get(key) ?? 0) + 1);
  };

  const formatElapsed = (): string => `${Math.max(0, Date.now() - startedAt)}ms`;

  const formatCounters = (): string => {
    const started = counts.get("item.started") ?? 0;
    const completed = counts.get("item.completed") ?? 0;
    const failed = counts.get("item.failed") ?? 0;
    const status = counts.get("turn.started") ?? 0;

    const parts: string[] = [];
    if (status) parts.push(`turns_started=${status}`);
    parts.push(`items_started=${started}`);
    parts.push(`items_completed=${completed}`);
    if (failed) parts.push(`items_failed=${failed}`);
    return parts.join(" ");
  };

  let lastSentAt = 0;
  const maybeSend = (): void => {
    const now = Date.now();
    if (now - lastSentAt < eventThrottleMs) return;
    lastSentAt = now;

    const suffixParts: string[] = [`elapsed=${formatElapsed()}`, formatCounters()];
    if (lastEventType) suffixParts.push(`last=${lastEventType}${lastItemType ? `(${lastItemType})` : ""}`);

    void options
      .log("info", `${options.label}: running (${suffixParts.filter(Boolean).join(" ")})`)
      .catch(() => {});
  };

  const heartbeat = (): void => {
    maybeSend();
  };

  return {
    start() {
      if (timer) return;
      void options.log("info", `${options.label}: started`).catch(() => {});
      timer = setInterval(heartbeat, heartbeatMs);
      timer.unref?.();
    },
    stop() {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
      void options
        .log("info", `${options.label}: finished (elapsed=${formatElapsed()} ${formatCounters()})`)
        .catch(() => {});
    },
    onEvent(event) {
      if (event.type) bump(event.type);
      if (event.type) lastEventType = event.type;
      if (event.item_type) lastItemType = event.item_type;
      maybeSend();
    },
  };
}
