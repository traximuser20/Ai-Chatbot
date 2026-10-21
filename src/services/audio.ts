import { Application, knownFolders, path as nsPath } from '@nativescript/core';
import { omniAi } from './omni-ai';

/**
 * Voice: recording, transcription and speech.
 *
 * The ears and the mouth of the app. Recording is a `MediaRecorder` driven
 * straight from the runtime. What is heard is turned into text with the
 * gateway's `POST /v1/audio/transcriptions`, and the answer is read out loud
 * with `POST /v1/audio/speech`.
 *
 * The gateway is the first choice for speech, because that is where the
 * voice of the model lives. When it cannot serve audio - no provider with an
 * audio model is configured, for instance - the built-in Android voice
 * (`TextToSpeech`) speaks instead, so a reply is never left silent.
 */

/** A recording that is running. */
export interface Recorder {
  /** Stops the recording and returns the file it wrote, or null if it is unusable. */
  stop(): Promise<{ path: string; mime: string } | null>;
  /** Aborts the recording and throws the file away. */
  cancel(): void;
}

/** The mime type the recorder writes, and what the gateway expects. */
const RECORD_MIME = 'audio/mp4';
const RECORD_EXTENSION = 'm4a';

/** A recording shorter than this is treated as a mis-tap. */
const MIN_RECORDING_MS = 400;

/** The longest a single recording is allowed to run. */
const MAX_RECORDING_MS = 5 * 60 * 1000;

/** The recorder that is running, if there is one. */
let active: {
  recorder: android.media.MediaRecorder;
  filePath: string;
  startedAt: number;
  timer: number;
} | undefined;

function context(): android.content.Context {
  return Application.android.context;
}

/** A unique, safe path in the app's temp folder. */
function tempAudioPath(): string {
  const unique = `voice_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  return nsPath.join(knownFolders.temp().path, `${unique}.${RECORD_EXTENSION}`);
}

/* ------------------------------------------------------------------ */
/* Recording                                                           */
/* ------------------------------------------------------------------ */

export interface StartRecordingOptions {
  /** Called when the recording hits the maximum length and stops itself. */
  onMaxDuration?: () => void;
}

/**
 * Starts recording from the microphone.
 *
 * Returns the handle used to stop it, or `null` when the microphone cannot
 * be opened. The caller is expected to have asked for the RECORD_AUDIO
 * permission first (`ensureMicrophone`).
 */
export function startRecording(options: StartRecordingOptions = {}): Recorder | null {
  if (!Application.android) {
    return null;
  }
  // Only one recording at a time.
  if (active) {
    void stopRecording();
  }

  const filePath = tempAudioPath();
  const recorder = new android.media.MediaRecorder();

  try {
    recorder.setAudioSource(android.media.MediaRecorder.AudioSource.MIC);
    // MPEG-4 / AAC is an .m4a - a container the transcription models accept.
    recorder.setOutputFormat(android.media.MediaRecorder.OutputFormat.MPEG_4);
    recorder.setAudioEncoder(android.media.MediaRecorder.AudioEncoder.AAC);
    // 16 kHz mono is what the speech models are trained on.
    recorder.setAudioSamplingRate(16000);
    recorder.setAudioEncodingBitRate(96000);
    recorder.setOutputFile(filePath);
    recorder.prepare();
    recorder.start();
  } catch (err) {
    console.error('Could not start recording:', err);
    try {
      recorder.release();
    } catch {
      /* ignore */
    }
    return null;
  }

  const startedAt = Date.now();
  // A runaway recording is stopped by the clock, not by the finger.
  const timer = setTimeout(() => options.onMaxDuration?.(), MAX_RECORDING_MS);

  active = { recorder, filePath, startedAt, timer };

  return {
    async stop(): Promise<{ path: string; mime: string } | null> {
      const duration = Date.now() - startedAt;
      await stopRecording();
      // A mis-tap is not a message - throw the file away.
      if (duration < MIN_RECORDING_MS) {
        deleteQuiet(filePath);
        return null;
      }
      return { path: filePath, mime: RECORD_MIME };
    },
    cancel(): void {
      void stopRecording();
    },
  };
}

/**
 * Stops the recording that is running and releases the microphone.
 * Resolves once the recorder is released.
 */
function stopRecording(): Promise<void> {
  return new Promise<void>((resolve) => {
    const current = active;
    active = undefined;
    if (!current) {
      resolve();
      return;
    }

    clearTimeout(current.timer);
    try {
      current.recorder.stop();
    } catch (err) {
      // stop() throws when nothing was actually written - not fatal here.
      console.warn('Stopping the recorder reported:', (err as Error)?.message ?? err);
    }
    try {
      current.recorder.release();
    } catch {
      /* ignore */
    }
    resolve();
  });
}

/** Deletes a temp file, ignoring any failure. */
function deleteQuiet(filePath: string) {
  try {
    const file = java.io.File.class ? new java.io.File(filePath) : null;
    if (file?.exists()) {
      file.delete();
    }
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ */
/* Transcription (speech to text, through the gateway)                 */
/* ------------------------------------------------------------------ */

/**
 * Turns a recording into text with the gateway.
 *
 * `model` is the transcription model id the gateway routes (see the settings
 * screen). The audio file is uploaded as multipart form data.
 */
export async function transcribe(filePath: string, model: string): Promise<string> {
  return omniAi.transcribeAudio(filePath, model);
}

/* ------------------------------------------------------------------ */
/* Speech (text to speech)                                             */
/* ------------------------------------------------------------------ */

/** The Android voice, created the first time it is needed. */
let androidTts: any;

/** True once the Android voice has finished initialising. */
let androidTtsReady = false;

/** A line waiting for the Android voice to be ready. */
let pendingAndroidText: string | undefined;

/** Plays gateway audio bytes from a temp file. */
let mediaPlayer: any;

/** The Android voice, when it is what is speaking. */
let speakingWithAndroid = false;

/** True while something is being read out loud. */
let speaking = false;

/** Speaks a line with the Android voice, now. */
function speakNowAndroid(text: string): void {
  try {
    androidTts.speak(
      text,
      android.speech.tts.TextToSpeech.QUEUE_FLUSH,
      null,
      `omni_${Date.now()}`,
    );
  } catch (err) {
    console.error('The platform voice could not speak:', err);
    speaking = false;
  }
}

/** Creates the Android voice once, with a listener that readies it. */
function ensureAndroidTts(): void {
  if (androidTts) {
    return;
  }
  const listener = new android.speech.tts.TextToSpeech.OnInitListener({
    onInit(status: number): void {
      if (status === android.speech.tts.TextToSpeech.SUCCESS) {
        try {
          androidTts.setLanguage(java.util.Locale.getDefault());
        } catch {
          /* a missing locale is not fatal */
        }
        androidTtsReady = true;
      }
      // The first line was queued before the voice was ready - say it now.
      const queued = pendingAndroidText;
      pendingAndroidText = undefined;
      if (queued) {
        speakNowAndroid(queued);
      }
    },
  });
  androidTts = new android.speech.tts.TextToSpeech(context(), listener);
}

export interface SpeakOptions {
  /** Transcription-style model id for the gateway's speech route. */
  model?: string;
  /** Voice name the gateway understands (alloy, echo, ...). */
  voice?: string;
  /** Called when the gateway cannot serve audio and the platform voice takes over. */
  onFallback?: (reason: string) => void;
}

/** True while a reply is being read out loud. */
export function isSpeaking(): boolean {
  return speaking;
}

/** Stops whatever is being read out loud. */
export function stopSpeaking(): void {
  speaking = false;
  speakingWithAndroid = false;
  pendingAndroidText = undefined;

  if (mediaPlayer) {
    try {
      mediaPlayer.stop();
      mediaPlayer.release();
    } catch {
      /* ignore */
    }
    mediaPlayer = null;
  }

  if (androidTts) {
    try {
      androidTts.stop();
    } catch {
      /* ignore */
    }
  }
}

/**
 * Reads a reply out loud.
 *
 * The gateway's speech route is asked first. If it fails - no audio-capable
 * provider is configured, for instance - the built-in Android voice speaks
 * the text instead, so the reply is never dropped on the floor.
 */
export async function speak(text: string, options: SpeakOptions = {}): Promise<void> {
  const clean = stripForSpeech(text);
  if (!clean) {
    return;
  }

  stopSpeaking();
  speaking = true;

  try {
    const audio = await omniAi.speech(clean, options.model, options.voice);
    await playBytes(audio);
    return;
  } catch (err) {
    const reason = (err as Error)?.message ?? String(err);
    console.warn('The gateway could not speak, falling back to the platform voice:', reason);
    options.onFallback?.(reason);
    speakWithAndroid(clean);
  }
}

/** Speaks a text with the built-in Android voice. */
function speakWithAndroid(text: string): void {
  if (!Application.android) {
    speaking = false;
    return;
  }
  try {
    speakingWithAndroid = true;
    ensureAndroidTts();
    if (androidTtsReady) {
      speakNowAndroid(text);
    } else {
      // The voice is still warming up - hold the line until it is ready.
      pendingAndroidText = text;
    }
  } catch (err) {
    console.error('The platform voice could not speak:', err);
    speaking = false;
  }
}

/** Plays audio bytes (the gateway's speech output) with a MediaPlayer. */
function playBytes(bytes: any): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (!Application.android) {
      resolve();
      return;
    }
    const filePath = nsPath.join(
      knownFolders.temp().path,
      `speech_${Date.now().toString(36)}.mp3`,
    );
    try {
      // The gateway's speech arrives as a Uint8Array - hand the file a real
      // Java byte array, which is what a FileOutputStream writes.
      const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes as ArrayBuffer);
      const jbytes = Array.create('byte', u8.length);
      for (let i = 0; i < u8.length; i++) {
        jbytes[i] = u8[i] & 0xff;
      }
      const fos = new java.io.FileOutputStream(filePath);
      fos.write(jbytes);
      fos.close();
    } catch (err) {
      reject(err);
      return;
    }

    const player = new android.media.MediaPlayer();
    mediaPlayer = player;

    player.setOnCompletionListener(
      new android.media.MediaPlayer.OnCompletionListener({
        onCompletion(mp: android.media.MediaPlayer): void {
          try {
            mp.release();
          } catch {
            /* ignore */
          }
          if (mediaPlayer === mp) {
            mediaPlayer = null;
          }
          speaking = false;
          deleteQuiet(filePath);
          resolve();
        },
      }),
    );

    player.setOnErrorListener(
      new android.media.MediaPlayer.OnErrorListener({
        onError(mp: android.media.MediaPlayer, what: number, extra: number): boolean {
          try {
            mp.release();
          } catch {
            /* ignore */
          }
          if (mediaPlayer === mp) {
            mediaPlayer = null;
          }
          speaking = false;
          deleteQuiet(filePath);
          reject(new Error('The audio could not be played.'));
          return true;
        },
      }),
    );

    try {
      player.setDataSource(filePath);
      player.setAudioStreamType(android.media.AudioManager.STREAM_MUSIC);
      player.prepare();
      player.start();
    } catch (err) {
      try {
        player.release();
      } catch {
        /* ignore */
      }
      mediaPlayer = null;
      speaking = false;
      deleteQuiet(filePath);
      reject(err);
    }
  });
}

/**
 * Makes text safe to speak.
 *
 * Markdown, code fences and URLs are stripped - a voice reading
 * "[a](https://b)" aloud is not what the model meant.
 */
function stripForSpeech(text: string): string {
  return (
    text
      .replace(/```[\s\S]*?```/g, ' code removed. ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/[#*_>~]/g, '')
      .replace(/https?:\/\/\S+/g, ' a link. ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}
