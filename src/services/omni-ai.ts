import { Application, ApplicationSettings, File } from '@nativescript/core';
import { isEmulator } from '../utils/device';

/**
 * Omni Ai client.
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
 * On a physical device the loopback interface belongs to the phone, so the
 * port of the gateway is forwarded to the machine that runs it:
 *
 *     adb reverse tcp:20128 tcp:20128
 *
 * With that tunnel in place the plain `127.0.0.1` address reaches the
 * gateway again. The user can also point the app at another address - the
 * LAN address of the machine that runs the gateway - from the settings
 * screen.
 */

/** The port the gateway listens on. */
export const GATEWAY_PORT = 20128;

/** Where a hand-picked address of the gateway is stored. */
const GATEWAY_KEY = 'omniai.gateway.address';

/**
 * The address the user picked by hand, if there is one.
 *
 * It is read once at start-up and kept in memory, so the app does not touch
 * the storage on every request.
 */
let override = readOverride();

function readOverride(): string {
  try {
    return (ApplicationSettings.getString(GATEWAY_KEY, '') || '').trim();
  } catch (err) {
    console.error('Could not read the gateway address:', err);
    return '';
  }
}

/**
 * The host of the gateway when the user has not picked one.
 *
 * The emulator sees the host behind `10.0.2.2`; a phone reaches the host
 * through its own loopback, with the port forwarded by `adb reverse`.
 */
export function defaultGatewayHost(): string {
  if (!Application.android) {
    return '127.0.0.1';
  }
  return isEmulator() ? '10.0.2.2' : '127.0.0.1';
}

/** The address of the gateway as it is used right now. */
export function gatewayUrl(): string {
  if (override) {
    // A hand-picked address may be written with or without the scheme.
    return override.startsWith('http')
      ? override.replace(/\/+$/, '')
      : `http://${override.replace(/\/+$/, '')}`;
  }
  return `http://${defaultGatewayHost()}:${GATEWAY_PORT}`;
}

/**
 * Points the app at another gateway.
 *
 * An empty value restores the default address of the platform.
 */
export function setGatewayAddress(value: string): void {
  const trimmed = (value || '').trim();
  override = trimmed;
  try {
    if (trimmed) {
      ApplicationSettings.setString(GATEWAY_KEY, trimmed);
    } else {
      ApplicationSettings.remove(GATEWAY_KEY);
    }
  } catch (err) {
    console.error('Could not save the gateway address:', err);
  }
}

/** The address the user picked by hand, if there is one. */
export function gatewayOverride(): string {
  return override;
}

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

/** Transcription model used for voice search and voice chat. */
export const DEFAULT_TRANSCRIBE_MODEL = 'whisper-1';

/** Speech model used to read replies out loud. */
export const DEFAULT_SPEECH_MODEL = 'tts-1';

/** The voice the speech model speaks with. */
export const DEFAULT_SPEECH_VOICE = 'alloy';

export interface OmniAiModel {
  id: string;
  owned_by?: string;
}

/**
 * One piece of a message's content.
 *
 * A message is usually a plain string, but it can be a list of parts - that
 * is how an image or a document travels with the words that describe it. The
 * shapes are the OpenAI multimodal ones, which the gateway passes through.
 */
export type ContentPart =
  /** A run of text. */
  | { type: 'text'; text: string }
  /** An image, as a data URL (`data:image/jpeg;base64,...`). Needs a vision model. */
  | { type: 'image_url'; image_url: { url: string } }
  /** A document, as a data URL. Needs a model that accepts file parts. */
  | { type: 'file'; file: { filename: string; file_data: string } };

export interface ChatMessagePayload {
  role: 'system' | 'user' | 'assistant';
  /** Plain text, or a list of parts when the message carries an attachment. */
  content: string | ContentPart[];
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

type StatusListener = (status: ConnectionStatus) => void;
type StreamListener = (chunk: string) => void;

export class OmniAiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    /** True when the user cancelled the request (the stop button). */
    readonly cancelled = false,
  ) {
    super(message);
    this.name = 'OmniAiError';
  }
}

class OmniAiService {
  private statusListeners: StatusListener[] = [];
  private availableModels: OmniAiModel[] = [];
  private modelsLoaded = false;

  constructor() {
    this.notifyStatus('connecting');
  }

  private notifyStatus(status: ConnectionStatus) {
    this.statusListeners.forEach((listener) => {
      try {
        listener(status);
      } catch (err) {
        console.error('Gateway status listener error:', err);
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
   * Fetches the list of models exposed by the gateway.
   * The list is cached - it changes rarely and the app only needs it when
   * the model picker is opened.
   */
  public async loadModels(force = false): Promise<OmniAiModel[]> {
    if (this.modelsLoaded && !force) {
      // The list is cached - the gateway is obviously reachable, so keep the
      // connection state in sync (the app may have been reloaded).
      this.notifyStatus('connected');
      return this.availableModels;
    }

    try {
      const response = await this.request('/v1/models', { method: 'GET' });
      const payload = await this.parseJson(response);
      this.availableModels = (payload?.data ?? []) as OmniAiModel[];
      this.modelsLoaded = true;
      this.notifyStatus('connected');
      return this.availableModels;
    } catch (err) {
      this.notifyStatus('error');
      throw err;
    }
  }

  public getModels(): OmniAiModel[] {
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

  /**
   * Turns a recording into text (speech to text).
   *
   * The audio file is uploaded as multipart form data to the gateway's
   * `POST /v1/audio/transcriptions`, which routes it to a transcription
   * model. The body is built by hand rather than with `FormData`, because
   * the NativeScript `fetch` does not serialise a file part reliably.
   */
  public async transcribeAudio(
    filePath: string,
    model: string = DEFAULT_TRANSCRIBE_MODEL,
  ): Promise<string> {
    try {
      const file = File.fromPath(filePath);
      const audio = javaBytesToU8(file.readSync());

      const boundary = `omniai${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      const head = asciiToU8(
        `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="model"\r\n\r\n` +
          `${model}\r\n` +
          `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="file"; filename="${file.name}"\r\n` +
          `Content-Type: audio/mp4\r\n\r\n`,
      );
      const tail = asciiToU8(`\r\n--${boundary}--\r\n`);

      const body = new Uint8Array(head.length + audio.length + tail.length);
      body.set(head, 0);
      body.set(audio, head.length);
      body.set(tail, head.length + audio.length);

      const response = await this.request('/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
        body,
      });

      const payload = await this.parseJson(response);
      this.notifyStatus('connected');
      return (payload?.text ?? '') as string;
    } catch (err) {
      this.notifyStatus('error');
      throw err;
    }
  }

  /**
   * Reads text out loud (text to speech).
   *
   * The gateway's `POST /v1/audio/speech` returns the spoken audio as bytes
   * (mp3 by default), which the caller plays. The response is binary, so it
   * is read as an `ArrayBuffer` rather than as text.
   */
  public async speech(
    text: string,
    model: string = DEFAULT_SPEECH_MODEL,
    voice: string = DEFAULT_SPEECH_VOICE,
  ): Promise<Uint8Array> {
    const response = await this.request('/v1/audio/speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        input: text,
        voice,
        response_format: 'mp3',
      }),
    });

    const buffer = await response.arrayBuffer();
    this.notifyStatus('connected');
    return new Uint8Array(buffer);
  }

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${API_KEY}`,
      ...((init.headers as Record<string, string>) ?? {}),
    };

    const base = gatewayUrl();

    let response: Response;
    try {
      response = await fetch(`${base}${path}`, { ...init, headers });
    } catch (err) {
      // An aborted request is not a failure - the user pressed stop.
      if ((init as RequestInit)?.signal?.aborted) {
        throw new OmniAiError('Request cancelled.', undefined, true);
      }
      // `fetch` rejects for network-level failures (host unreachable, DNS,
      // connection refused). Turn that into a readable error.
      throw new OmniAiError(
        `Could not reach the Omni Ai gateway at ${base}. Is it running? (${
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
      throw new OmniAiError(
        `Gateway request failed (HTTP ${response.status})${
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
      throw new OmniAiError('The gateway returned a malformed response.');
    }
  }
}

/**
 * Copies a Java `byte[]` into a JS `Uint8Array`.
 *
 * `File.readSync()` returns a Java byte array, which the bridge exposes as a
 * proxy that can be indexed but is not a typed array. The copy also clears
 * the sign, so a byte above 0x7F survives the round trip.
 */
function javaBytesToU8(bytes: any): Uint8Array {
  if (bytes instanceof Uint8Array) {
    return bytes;
  }
  const length = bytes?.length ?? 0;
  const out = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    out[i] = bytes[i] & 0xff;
  }
  return out;
}

/** Encodes an ASCII/UTF-8 string as bytes, for a multipart header. */
function asciiToU8(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) {
    out[i] = text.charCodeAt(i) & 0xff;
  }
  return out;
}

export const omniAi = new OmniAiService();
