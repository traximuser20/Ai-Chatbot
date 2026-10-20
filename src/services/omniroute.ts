import { Application } from '@nativescript/core';

/**
 * OmniRoute client.
 *
 * OmniRoute exposes an OpenAI-compatible HTTP API:
 *
 *   GET  /v1/models            -> list of available models
 *   POST /v1/chat/completions  -> chat completion (OpenAI Chat Completions shape)
 *
 * It does NOT speak Socket.IO, so the app talks to it over plain HTTP.
 * (Socket.IO was previously used against a bespoke backend; that server
 * does not exist any more.)
 *
 * ── Networking ────────────────────────────────────────────────────────────────
 * From inside an Android emulator `localhost` / `127.0.0.1` point at the
 * emulator itself, not the developer machine. `10.0.2.2` is the alias the
 * Android emulator maps to the host's loopback interface, so a backend
 * listening on the host on port 20128 is reachable at http://10.0.2.2:20128.
 *
 * On a physical device, replace this with the host's LAN IP address.
 */
const HOST = Application.android ? '10.0.2.2' : '127.0.0.1';
const PORT = 20128;
export const BASE_URL = `http://${HOST}:${PORT}`;

/**
 * API key for the local OmniRoute instance.
 *
 * OmniRoute issues a key for local clients (see `OMNIROUTE_API_KEY` in the
 * environment of the machine running OmniRoute). The app is a development
 * client talking to a developer-local gateway, so the key lives here rather
 * than in a build-time secret pipeline.
 */
export const API_KEY = 'sk-cf2c8acbccfc179f-443d10-95acbd1b';

/** Model used when the user has not picked one. */
export const DEFAULT_MODEL = 'auto/best-fast';

export interface OmniRouteModel {
  id: string;
  owned_by?: string;
}

export interface ChatMessagePayload {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

type StatusListener = (status: ConnectionStatus) => void;
type StreamListener = (chunk: string) => void;

export class OmniRouteError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    /** True when the user cancelled the request (the stop button). */
    readonly cancelled = false,
  ) {
    super(message);
    this.name = 'OmniRouteError';
  }
}

class OmniRouteService {
  private statusListeners: StatusListener[] = [];
  private availableModels: OmniRouteModel[] = [];
  private modelsLoaded = false;

  constructor() {
    this.notifyStatus('connecting');
  }

  private notifyStatus(status: ConnectionStatus) {
    this.statusListeners.forEach((listener) => {
      try {
        listener(status);
      } catch (err) {
        console.error('OmniRoute status listener error:', err);
      }
    });
  }

  /** Registers a connection-status listener. Returns an unsubscribe function. */
  public onStatus(listener: StatusListener): () => void {
    this.statusListeners.push(listener);
    listener('connecting');
    return () => {
      this.statusListeners = this.statusListeners.filter((l) => l !== listener);
    };
  }

  /**
   * Fetches the list of models exposed by OmniRoute.
   * The list is cached - it changes rarely and the app only needs it when
   * the model picker is opened.
   */
  public async loadModels(force = false): Promise<OmniRouteModel[]> {
    if (this.modelsLoaded && !force) {
      // The list is cached - the gateway is obviously reachable, so keep the
      // connection state in sync (the app may have been reloaded).
      this.notifyStatus('connected');
      return this.availableModels;
    }

    try {
      const response = await this.request('/v1/models', { method: 'GET' });
      const payload = await this.parseJson(response);
      this.availableModels = (payload?.data ?? []) as OmniRouteModel[];
      this.modelsLoaded = true;
      this.notifyStatus('connected');
      return this.availableModels;
    } catch (err) {
      this.notifyStatus('error');
      throw err;
    }
  }

  public getModels(): OmniRouteModel[] {
    return this.availableModels;
  }

  /**
   * Sends a chat completion request.
   *
   * The answer is delivered through `onChunk` as the model produces it.
   * NativeScript's XMLHttpRequest (which backs `fetch`) buffers the whole
   * response, so the completion is streamed to the caller in one piece
   * rather than token by token.
   *
   * `signal` aborts the request in flight - the composer uses it for the
   * stop button.
   */
  public async sendChat(
    messages: ChatMessagePayload[],
    model: string = DEFAULT_MODEL,
    onChunk?: StreamListener,
    signal?: AbortSignal,
  ): Promise<string> {
    try {
      const response = await this.request('/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, stream: false }),
        signal,
      });

      const payload = await this.parseJson(response);
      const text: string = payload?.choices?.[0]?.message?.content ?? '';

      this.notifyStatus('connected');

      if (onChunk && text) {
        onChunk(text);
      }

      return text;
    } catch (err) {
      this.notifyStatus('error');
      throw err;
    }
  }

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${API_KEY}`,
      ...((init.headers as Record<string, string>) ?? {}),
    };

    let response: Response;
    try {
      response = await fetch(`${BASE_URL}${path}`, { ...init, headers });
    } catch (err) {
      // An aborted request is not a failure - the user pressed stop.
      if ((init as RequestInit)?.signal?.aborted) {
        throw new OmniRouteError('Request cancelled.', undefined, true);
      }
      // `fetch` rejects for network-level failures (host unreachable, DNS,
      // connection refused). Turn that into a readable error.
      throw new OmniRouteError(
        `Could not reach OmniRoute at ${BASE_URL}. Is it running? (${
          (err as Error)?.message ?? err
        })`,
      );
    }

    if (!response.ok) {
      let detail = '';
      try {
        detail = await response.text();
      } catch {
        /* ignore - the body may not be readable */
      }
      throw new OmniRouteError(
        `OmniRoute request failed (HTTP ${response.status})${
          detail ? `: ${detail.slice(0, 200)}` : ''
        }`,
        response.status,
      );
    }

    return response;
  }

  private async parseJson(response: Response): Promise<any> {
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new OmniRouteError('OmniRoute returned a malformed response.');
    }
  }
}

export const omniRoute = new OmniRouteService();
