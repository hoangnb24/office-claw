import type { ConnectionStatus } from "../state/worldStore";

interface ConnectionStateUpdate {
  status: ConnectionStatus;
  reconnectAttempt?: number;
  error?: string | null;
}

interface ResumeCursor {
  lastSeq: number | null;
  lastSnapshotId: string | null;
}

interface WorldSocketClientOptions {
  url: string;
  sceneId: string;
  onConnectionState: (update: ConnectionStateUpdate) => void;
  onEnvelope: (envelope: unknown) => void;
  onCommandResult?: (result: {
    kind: "ack" | "error";
    commandId: string;
    commandName?: string;
    code?: string;
    message?: string;
  }) => void;
  onResumeCursor: (cursor: Partial<ResumeCursor>) => void;
  getResumeCursor: () => ResumeCursor;
}

interface Envelope {
  type: string;
  id?: string;
  payload?: Record<string, unknown>;
}

function parseEnvelope(raw: string): Envelope | null {
  try {
    return JSON.parse(raw) as Envelope;
  } catch {
    return null;
  }
}

function reconnectDelayMs(attempt: number): number {
  if (attempt <= 1) {
    return 1000;
  }
  if (attempt === 2) {
    return 2000;
  }
  if (attempt === 3) {
    return 4000;
  }
  return 8000 + Math.floor(Math.random() * 500);
}

export class WorldSocketClient {
  private readonly options: WorldSocketClientOptions;
  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private stopped = false;
  private readonly pendingCommands = new Map<string, { name: string }>();

  constructor(options: WorldSocketClientOptions) {
    this.options = options;
  }

  start(): void {
    this.stopped = false;
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.onopen = null;
      this.socket.onmessage = null;
      this.socket.onerror = null;
      this.socket.onclose = null;
      this.socket.close();
      this.socket = null;
    }
    this.options.onConnectionState({ status: "disconnected", reconnectAttempt: 0 });
  }

  private connect(): void {
    if (this.stopped) {
      return;
    }

    const status = this.reconnectAttempt === 0 ? "connecting" : "reconnecting";
    this.options.onConnectionState({
      status,
      reconnectAttempt: this.reconnectAttempt,
      error: null
    });

    this.socket = new WebSocket(this.options.url);

    this.socket.onopen = () => {
      this.reconnectAttempt = 0;
      this.options.onConnectionState({ status: "connected", reconnectAttempt: 0, error: null });
      this.sendHello();
    };

    this.socket.onmessage = (event) => {
      const envelope = parseEnvelope(String(event.data));
      if (!envelope) {
        return;
      }

      this.options.onEnvelope(envelope);

      if (typeof envelope.payload?.seq === "number") {
        this.options.onResumeCursor({ lastSeq: envelope.payload.seq });
      }

      if (envelope.type === "snapshot" && envelope.id) {
        this.options.onResumeCursor({ lastSnapshotId: envelope.id });
      }

      if (envelope.type === "hello_ack") {
        this.sendSubscribe();
      } else if (envelope.type === "ack" || envelope.type === "error") {
        this.handleCommandResult(envelope);
      }
    };

    this.socket.onerror = () => {
      this.options.onConnectionState({
        status: "error",
        reconnectAttempt: this.reconnectAttempt,
        error: "WebSocket transport error"
      });
    };

    this.socket.onclose = () => {
      this.socket = null;
      if (this.stopped) {
        return;
      }

      this.options.onConnectionState({
        status: "stale",
        reconnectAttempt: this.reconnectAttempt,
        error: "Connection lost. Retrying automatically."
      });
      this.scheduleReconnect();
    };
  }

  sendCommand(name: string, data: Record<string, unknown>): string | null {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return null;
    }

    const commandId = crypto.randomUUID();
    this.pendingCommands.set(commandId, { name });

    this.socket.send(
      JSON.stringify({
        type: "command",
        id: commandId,
        ts: Date.now(),
        v: 1,
        payload: {
          name,
          data
        }
      })
    );

    return commandId;
  }

  private scheduleReconnect(): void {
    if (this.stopped) {
      return;
    }

    this.reconnectAttempt += 1;
    const delay = reconnectDelayMs(this.reconnectAttempt);

    this.options.onConnectionState({
      status: "reconnecting",
      reconnectAttempt: this.reconnectAttempt
    });

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private sendHello(): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    const resume = this.options.getResumeCursor();

    this.socket.send(
      JSON.stringify({
        type: "hello",
        id: crypto.randomUUID(),
        ts: Date.now(),
        v: 1,
        payload: {
          client: {
            name: "officeclaw-web",
            build: "dev",
            platform: "web"
          },
          resume: {
            last_seq: resume.lastSeq,
            last_snapshot_id: resume.lastSnapshotId,
            scene_id: this.options.sceneId
          }
        }
      })
    );
  }

  private sendSubscribe(): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    this.socket.send(
      JSON.stringify({
        type: "subscribe",
        id: crypto.randomUUID(),
        ts: Date.now(),
        v: 1,
        payload: {
          scene_id: this.options.sceneId,
          channels: {
            events: true,
            snapshots: true,
            goals: true,
            chat: true
          }
        }
      })
    );
  }

  private handleCommandResult(envelope: Envelope) {
    const inReplyTo = typeof envelope.payload?.in_reply_to === "string"
      ? envelope.payload.in_reply_to
      : null;
    if (!inReplyTo) {
      return;
    }

    const pending = this.pendingCommands.get(inReplyTo);
    this.pendingCommands.delete(inReplyTo);

    if (envelope.type === "ack") {
      this.options.onCommandResult?.({
        kind: "ack",
        commandId: inReplyTo,
        commandName: pending?.name
      });
      return;
    }

    this.options.onCommandResult?.({
      kind: "error",
      commandId: inReplyTo,
      commandName: pending?.name,
      code: typeof envelope.payload?.code === "string" ? envelope.payload.code : undefined,
      message:
        typeof envelope.payload?.message === "string" ? envelope.payload.message : undefined
    });
  }
}
