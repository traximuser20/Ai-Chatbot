<script lang="ts" setup>
/**
 * The chat screen - and the home screen, which is the same screen without a
 * conversation.
 *
 * Layout (top to bottom):
 *  - A Material 3 top app bar: the navigation handle, the active route as a
 *    chip that opens the model sheet, and the live state of the gateway.
 *    The system bars are transparent, so the status bar is seen on the same
 *    surface as the app bar - the two read as one band.
 *  - A scrollable conversation. Assistant replies are rendered as Markdown,
 *    user messages sit in a container bubble on the right.
 *  - A composer with a filled text field and a filled icon button.
 *
 * Every colour of the screen is a role of the Material 3 scheme
 * (`var(--md-*)`), so the whole interface follows the theme *and* the route
 * that answers. The palette itself is written by `src/utils/dynamic-color.ts`.
 *
 * Overlays sit on top of the grid - the navigation drawer, the model
 * picker, the attach sheet and the voice sheet - and each spans all rows
 * so it covers the whole screen.
 */
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { $navigateTo } from 'nativescript-vue';
import { Application, Screen } from '@nativescript/core';
import { useChatStore } from '../stores/chat';
import { useSettingsStore } from '../stores/settings';
import { useThemeStore } from '../stores/theme';
import { usePaletteStore } from '../stores/palette';
import { omniAi, OmniAiError, type OmniAiModel } from '../services/omni-ai';
import { providerOf } from '../utils/accent';
import { enter, loopAnimation } from '../utils/motion';
import { paintRootBackground, restoreSystemBars } from '../utils/status-bar';
import { themeToken } from '../utils/theme';
import ChatMessage from './ChatMessage.vue';
import Sidebar from './Sidebar.vue';
import ModelSheet from './ModelSheet.vue';
import Profile from './Profile.vue';
import Settings from './Settings.vue';
import SplashScreen from './SplashScreen.vue';
import SendButton from './SendButton.vue';
import Icon from './Icon.vue';
import VoiceSheet from './VoiceSheet.vue';
import AttachSheet from './AttachSheet.vue';
import { pickImage, pickFile, takePhoto } from '../services/media';
import { speak, stopSpeaking } from '../services/audio';
import { notifyReply } from '../services/notifications';
import { ensureAttachments, ensureCamera } from '../services/permissions';
import { buildAttachment } from '../utils/attachments';
import type { Attachment } from '../stores/chat';

const chatStore = useChatStore();
const settings = useSettingsStore();
const theme = useThemeStore();
const palette = usePaletteStore();

const userInput = ref('');
const scrollRef = ref(null);
const contentRef = ref(null);

const models = ref<OmniAiModel[]>([]);
const showModelPicker = ref(false);
const drawerOpen = ref(false);
const loadingModels = ref(false);

/** The launch sequence plays once, on top of the chat screen. */
const showSplash = ref(true);

/** Suggestions offered on the empty screen. */
const suggestions = [
  'Explain an error',
  'Write a bash one-liner',
  'Draft a commit message',
  'Compare two SQL queries',
];

/** Provider prefix of the current model. */
const provider = computed(() => providerOf(chatStore.model));

/** Model name without the provider prefix. */
const modelLabel = computed(() => {
  const slash = chatStore.model.indexOf('/');
  return slash > -1 ? chatStore.model.slice(slash + 1) : chatStore.model;
});

const canSend = computed(
  () =>
    (userInput.value.trim().length > 0 || attachments.value.length > 0) && !chatStore.isTyping,
);

/**
 * The state of the send button.
 *
 * It is a stop button while an answer is on its way, it is filled when
 * there is something to send, and it is dimmed when there is not.
 */
const sendState = computed<'idle' | 'ready' | 'busy'>(() => {
  if (chatStore.isTyping) {
    return 'busy';
  }
  return canSend.value ? 'ready' : 'idle';
});

const statusText = computed(() => (chatStore.isConnected ? 'live' : 'offline'));

/** The request that is currently in flight, so it can be stopped. */
let inFlight: AbortController | undefined;

/** The message that failed, so it can be sent again. */
let failedText = '';
/** The attachments the failed message carried, so the retry keeps them. */
let failedAttachments: Attachment[] = [];

/** A short, actionable description of the last failure. */
const lastError = ref('');

/* ------------------------------------------------------------------ */
/* Attachments and voice                                               */
/* ------------------------------------------------------------------ */

/** Files waiting to be sent with the next message. */
const attachments = ref<Attachment[]>([]);
/** True while the attach sheet is open. */
const showAttachSheet = ref(false);
/** True while the voice sheet is open for a chat message. */
const showVoiceChat = ref(false);
/** True when the message was dictated, so its reply is read out loud. */
const voiceChatActive = ref(false);

/* ------------------------------------------------------------------ */
/* Motion                                                               */
/* ------------------------------------------------------------------ */

/** Elements of the empty state, so they can be animated in. */
const heroMark = ref<any>(null);
const heroTitle = ref<any>(null);
const heroSub = ref<any>(null);
const heroChips = ref<any[]>([]);
const liveDot = ref<any>(null);
const typingDots = ref<any[]>([]);

/**
 * The loops that are currently running.
 *
 * Every loop keeps an animation chain alive, so it has to be stopped when
 * its view goes away - otherwise the chains pile up and eat the heap.
 */
let stopHero: (() => void) | undefined;
let stopLive: (() => void) | undefined;
let stopTyping: (() => void)[] = [];

/** Brings the empty state in, one element after the other. */
function animateHero() {
  stopHero?.();
  stopHero = undefined;

  nextTick(() => {
    enter(heroMark.value?.nativeView, { distance: 22, duration: 700, curve: 'easeOut' });
    enter(heroTitle.value?.nativeView, { delay: 90, distance: 16 });
    enter(heroSub.value?.nativeView, { delay: 160, distance: 12 });
    heroChips.value.forEach((chip, index) => {
      enter(chip?.nativeView, { delay: 230 + index * 60, distance: 10, duration: 460 });
    });

    // The mark breathes while the screen is idle.
    stopHero = loopAnimation(heroMark.value?.nativeView, [
      { properties: { scale: { x: 1.06, y: 1.06 } }, duration: 2600 },
      { properties: { scale: { x: 1, y: 1 } }, duration: 2600 },
    ]);
  });
}

/** The live indicator pulses while the gateway is reachable. */
function startLivePulse() {
  stopLive = loopAnimation(liveDot.value?.nativeView, [
    { properties: { opacity: 0.5, scale: { x: 0.85, y: 0.85 } }, duration: 1100 },
    { properties: { opacity: 1, scale: { x: 1.1, y: 1.1 } }, duration: 1100 },
  ]);
}

/** The three dots hop while the answer is on the way. */
function startTypingDots() {
  stopTyping.forEach((stop) => stop());
  stopTyping = [];

  typingDots.value.forEach((dot, index) => {
    stopTyping.push(
      loopAnimation(
        dot?.nativeView,
        [
          { properties: { opacity: 0.3, translate: { x: 0, y: 0 } }, duration: 520 },
          { properties: { opacity: 1, translate: { x: 0, y: -4 } }, duration: 520 },
          { properties: { opacity: 0.3, translate: { x: 0, y: 0 } }, duration: 520 },
        ],
        { delay: index * 140 },
      ),
    );
  });
}

/** Stops every loop that is running. */
function stopAllLoops() {
  stopHero?.();
  stopLive?.();
  stopTyping.forEach((stop) => stop());
  stopHero = undefined;
  stopLive = undefined;
  stopTyping = [];
}

let unsubscribeStatus: (() => void) | undefined;

onMounted(async () => {
  unsubscribeStatus = omniAi.onStatus((status) => {
    chatStore.setConnectionStatus(status === 'connected');
  });

  Application.on(Application.suspendEvent, onSuspend);
  Application.on(Application.resumeEvent, onResume);

  // Probe the gateway so the header shows the real connection state.
  try {
    models.value = await omniAi.loadModels();
  } catch (err) {
    console.error('Could not load models:', err);
  }

  nextTick(() => {
    startLivePulse();
    if (!chatStore.messages.length) {
      animateHero();
    }
  });
});

onUnmounted(() => {
  unsubscribeStatus?.();
  stopAllLoops();
  stopSpeaking();
  Application.off(Application.suspendEvent, onSuspend);
  Application.off(Application.resumeEvent, onResume);
});

/**
 * The endless animations are stopped while the app is in the background and
 * started again when it comes back. An animation of a view that is not on
 * screen is resolved at once, and a chain of those would spin the thread.
 */
function onSuspend() {
  stopAllLoops();
  stopSpeaking();
}

function onResume() {
  startLivePulse();
  if (!chatStore.messages.length) {
    animateHero();
  }
}

// The empty state appears again whenever the last message is cleared.
watch(
  () => chatStore.messages.length,
  (length) => {
    if (length === 0) {
      animateHero();
    } else {
      // The mark is gone, its loop has to go with it.
      stopHero?.();
      stopHero = undefined;
    }
  },
);

/*
  The system bars are transparent, so what is seen under them is the
  background of the root view. It has to follow the palette of the theme -
  and the palette of the route, whose neutral greys carry the hue of the
  accent. So the bars and the ground behind them are repainted whenever one
  of the two changes.

  The paint happens on the next tick, because the root view - which carries
  the palette - is repainted with the rest of the interface.
*/
watch(
  () => [theme.name, palette.scheme] as const,
  () => {
    nextTick(() => {
      const surface = themeToken('--md-surface', '#F8F8FA');
      paintRootBackground(surface);
      restoreSystemBars(surface, surface, theme.isDark);
    });
  },
);

// The dots only hop while a reply is on its way. The send button has its
// own motion while it waits - it breathes - so it lives in its own
// component.
watch(
  () => chatStore.isTyping,
  (typing) => {
    if (typing) {
      nextTick(() => {
        startTypingDots();
      });
    } else {
      stopTyping.forEach((stop) => stop());
      stopTyping = [];
    }
  },
);
/**
 * Scrolls the conversation to the newest message.
 *
 * `scrollToVerticalOffset` expects device independent pixels, while
 * `getMeasuredHeight()` reports device pixels - hence the density factor.
 */
function scrollToBottom(animated = true) {
  nextTick(() => {
    // The native layout pass runs after the Vue render, so the measurement
    // has to wait a tick as well.
    setTimeout(() => {
      const scroll = scrollRef.value?.nativeView;
      const content = contentRef.value?.nativeView;
      if (!scroll) {
        return;
      }
      try {
        const density = Screen.mainScreen.scale || 1;
        const contentHeight = (content?.getMeasuredHeight?.() ?? 0) / density;
        const viewport = (scroll.getMeasuredHeight?.() ?? 0) / density;
        const offset = Math.max(0, contentHeight - viewport);
        scroll.scrollToVerticalOffset(offset, animated);
      } catch (err) {
        console.error('Could not scroll to the bottom:', err);
      }
    }, 100);
  });
}

async function openModelPicker() {
  showModelPicker.value = true;
  if (models.value.length) {
    return;
  }
  loadingModels.value = true;
  try {
    models.value = await omniAi.loadModels(true);
  } catch (err) {
    console.error('Could not load models:', err);
  } finally {
    loadingModels.value = false;
  }
}

function closeModelPicker() {
  showModelPicker.value = false;
}

function selectModel(model: OmniAiModel) {
  chatStore.setModel(model.id);
  closeModelPicker();
}

/* ------------------------------------------------------------------ */
/* Drawer actions                                                      */
/* ------------------------------------------------------------------ */

/** The splash has finished animating away. */
function onSplashDone() {
  showSplash.value = false;
}

function onNewChat() {
  chatStore.newChat();
  userInput.value = '';
  attachments.value = [];
  stopSpeaking();
  drawerOpen.value = false;
}

function openProfile() {
  drawerOpen.value = false;
  $navigateTo(Profile, { transition: { name: 'slide', duration: 260 } });
}

function openSettings() {
  drawerOpen.value = false;
  $navigateTo(Settings, { transition: { name: 'slide', duration: 260 } });
}

/* ------------------------------------------------------------------ */
/* Composer                                                            */
/* ------------------------------------------------------------------ */

function useSuggestion(text: string) {
  userInput.value = text;
}

/* ------------------------------------------------------------------ */
/* Attachments                                                         */
/* ------------------------------------------------------------------ */

function openAttachSheet() {
  showAttachSheet.value = true;
}

/** Picks a file from the chosen source and queues it as an attachment. */
async function onAttachPick(source: 'gallery' | 'camera' | 'document') {
  showAttachSheet.value = false;
  try {
    let picked = null;
    if (source === 'gallery') {
      await ensureAttachments();
      picked = await pickImage();
    } else if (source === 'camera') {
      const granted = await ensureCamera();
      if (!granted) {
        lastError.value = 'The camera is off. Allow camera access in Settings to take a photo.';
        return;
      }
      picked = await takePhoto();
    } else {
      await ensureAttachments();
      picked = await pickFile();
    }

    if (!picked) {
      return;
    }
    attachments.value = [...attachments.value, buildAttachment(picked)];
    lastError.value = '';
  } catch (err) {
    console.error('Could not attach the file:', err);
    lastError.value = 'That file could not be attached.';
  }
}

function removeAttachment(index: number) {
  attachments.value = attachments.value.filter((_, i) => i !== index);
}

/* ------------------------------------------------------------------ */
/* Voice chat                                                          */
/* ------------------------------------------------------------------ */

function openVoiceChat() {
  showVoiceChat.value = true;
}

/** The voice sheet finished: the words become the message. */
function onVoiceDone(text: string) {
  showVoiceChat.value = false;
  userInput.value = text;
  voiceChatActive.value = true;
  sendMessage();
}

function onVoiceChatClose() {
  showVoiceChat.value = false;
}

function onSubmit() {
  if (settings.sendOnEnter) {
    sendMessage();
  }
}

async function sendMessage() {
  const text = userInput.value.trim();
  const files = attachments.value;
  if ((!text && !files.length) || chatStore.isTyping) {
    return;
  }

  userInput.value = '';
  attachments.value = [];
  chatStore.addMessage(text, 'user', { attachments: files.length ? files : undefined });
  chatStore.setTypingStatus(true);
  scrollToBottom();

  const history = chatStore.buildHistory(
    'You are a helpful assistant. Answer concisely and use Markdown.',
  );

  const controller = new AbortController();
  inFlight = controller;
  failedText = text;
  failedAttachments = files;

  try {
    const reply = await omniAi.sendChat(history, chatStore.model, undefined, controller.signal);
    chatStore.setTypingStatus(false);
    lastError.value = '';

    if (reply && reply.trim()) {
      chatStore.addMessage(reply, 'ai');
      afterReply(reply);
    } else {
      lastError.value = 'The gateway answered with an empty reply.';
    }
    scrollToBottom();
    // The layout can still change afterwards (the keyboard closing for
    // example), so make sure the conversation ends up at the newest message.
    setTimeout(() => scrollToBottom(false), 320);
  } catch (error) {
    chatStore.setTypingStatus(false);
    voiceChatActive.value = false;

    // A cancelled request is not an error - the user pressed stop.
    if (error instanceof OmniAiError && error.cancelled) {
      return;
    }

    /*
      A failure is not a message of the conversation: it would be stored with
      the chat and would show up in the history for ever. It is reported in a
      banner above the composer instead, with a way to try again.
    */
    lastError.value = describeError(error);
    console.error('The request failed:', error);
  } finally {
    inFlight = undefined;
  }
}

/**
 * What happens the moment an answer lands.
 *
 * Two things the reader asked for: the reply is read out loud when the
 * exchange was started with the voice (or the "speak replies" toggle is on),
 * and a notification is posted when the app is in the background, so an
 * answer is never missed.
 */
function afterReply(reply: string) {
  if (voiceChatActive.value || settings.speakReplies) {
    void speak(reply, {
      model: settings.ttsModel,
      voice: settings.ttsVoice,
      onFallback: (reason) => console.warn('Spoke with the platform voice:', reason),
    });
  }
  voiceChatActive.value = false;

  // A reply that arrives while the app is open needs no notification.
  if (Application.inBackground && settings.notifications) {
    const title = chatStore.activeConversation?.title || provider.value || 'Omni Ai';
    notifyReply({ title, text: reply.slice(0, 400) });
  }
}

/** Turns an error into something a person can act on. */
function describeError(error: unknown): string {
  if (error instanceof OmniAiError && error.status) {
    return `The gateway answered with an error (${error.status}).`;
  }
  if (error instanceof Error && /Could not reach/i.test(error.message)) {
    return 'The gateway is unreachable. Check that Omni Ai is running.';
  }
  return 'The request failed. Tap retry to try again.';
}

/** Sends the last message again. */
function retryLastMessage() {
  if (!failedText || chatStore.isTyping) {
    return;
  }
  lastError.value = '';
  userInput.value = failedText;
  // The files go out with the retry as well - they were dropped from the
  // composer when the message was first sent.
  attachments.value = failedAttachments;
  failedAttachments = [];
  sendMessage();
}

/** Stops the request that is currently in flight. */
function stopGenerating() {
  inFlight?.abort();
}

/** The send button was pressed: send the message, or stop the answer. */
function onSendPress() {
  if (chatStore.isTyping) {
    stopGenerating();
    return;
  }
  sendMessage();
}
</script>

<template>
  <Page actionBarHidden="true">
    <GridLayout rows="auto, *, auto" class="page-root">
      <!-- ============ Top app bar ============ -->
      <GridLayout row="0" columns="auto, *, auto" class="md-top-bar app-bar">
        <!-- Navigation handle -->
        <GridLayout
          col="0"
          columns="auto"
          class="md-icon-button app-bar-handle"
          v-press
          @tap="drawerOpen = true"
        >
          <Icon col="0" name="menu" :size="22" tone="on-surface-variant" />
        </GridLayout>

        <!-- Active route: tapping it opens the model picker. -->
        <GridLayout
          col="1"
          columns="auto, auto, auto, auto"
          class="route-chip"
          v-press
          @tap="openModelPicker"
        >
          <Icon col="0" name="dot" :size="8" tone="primary" class="route-chip-dot" />
          <Label col="1" :text="provider" class="route-chip-provider" />
          <Label col="2" :text="modelLabel" class="route-chip-model" />
          <Icon col="3" name="chevron-down" :size="14" tone="on-secondary-container" />
        </GridLayout>

        <!-- Gateway state -->
        <GridLayout col="2" columns="auto, auto" class="status-chip">
          <Icon
            ref="liveDot"
            col="0"
            name="dot"
            :size="8"
            :tone="chatStore.isConnected ? 'live' : 'offline'"
          />
          <Label col="1" :text="statusText" class="status-text" />
        </GridLayout>
      </GridLayout>

      <!-- ============ Conversation ============ -->
      <ScrollView row="1" ref="scrollRef" class="message-scroll">
        <!-- Empty state: the home screen -->
        <StackLayout v-if="!chatStore.messages.length" class="hero">
          <!--
            The brand mark: a rotated square split by a single beam - one
            request in, one answer out.
          -->
          <GridLayout ref="heroMark" rows="auto" columns="auto" class="hero-mark-wrap">
            <Image
              row="0"
              col="0"
              src="~/assets/img/prism-glow.png"
              class="hero-glow"
              opacity="0.5"
            />
            <Image row="0" col="0" src="~/assets/img/prism.png" class="hero-mark" />
          </GridLayout>
          <Label ref="heroTitle" text="What should we route?" class="hero-title" />
          <Label
            ref="heroSub"
            textWrap="true"
            class="hero-sub"
            :text="`${models.length || 578} models are one tap away. Pick a route, then ask.`"
          />

          <WrapLayout class="hero-chips">
            <Label
              v-for="(suggestion, index) in suggestions"
              :key="suggestion"
              :ref="(el) => (heroChips[index] = el)"
              :text="suggestion"
              class="md-chip hero-chip"
              v-press
              @tap="useSuggestion(suggestion)"
            />
          </WrapLayout>
        </StackLayout>

        <!-- Messages -->
        <StackLayout v-else ref="contentRef" class="message-list">
          <ChatMessage
            v-for="(message, index) in chatStore.messages"
            :key="index"
            :text="message.text"
            :sender="message.sender"
            :timestamp="message.timestamp"
            :is-error="message.isError"
            :model="message.model"
            :scale="settings.fontScale"
            :show-timestamp="settings.showTimestamps"
            :attachments="message.attachments"
          />

          <!-- Pending indicator -->
          <StackLayout v-if="chatStore.isTyping" class="typing-row">
            <!--
              orientation="horizontal" is required: a StackLayout defaults to
              vertical, which stacked the three dots in a tall narrow pill
              instead of a single horizontal row of dots.
            -->
            <StackLayout orientation="horizontal" class="typing-bubble">
              <Icon
                v-for="(dot, index) in [0, 1, 2]"
                :key="index"
                :ref="(el) => (typingDots[index] = el)"
                name="dot"
                :size="9"
                tone="on-surface-variant"
                class="typing-mark"
              />
            </StackLayout>
          </StackLayout>
        </StackLayout>
      </ScrollView>

      <!-- ============ Composer ============ -->
      <StackLayout row="2" class="composer-area">
        <!--
          A failure is reported here instead of in the conversation: it is
          not part of what was said, and it can be acted on right here.
        -->
        <GridLayout v-if="lastError" columns="auto, *, auto" class="error-banner">
          <Icon col="0" name="warning" :size="16" tone="error" class="error-banner-icon" />
          <Label col="1" :text="lastError" textWrap="true" class="error-banner-text" />
          <Label
            col="2"
            text="RETRY"
            class="error-banner-action"
            v-press
            @tap="retryLastMessage"
          />
        </GridLayout>

        <!--
          Attachments that are waiting to be sent. Each chip can be tapped to
          drop the file before the message goes out.
        -->
        <WrapLayout v-if="attachments.length" class="attach-chips">
          <GridLayout
            v-for="(attachment, index) in attachments"
            :key="`${attachment.name}-${index}`"
            columns="auto, auto, auto"
            class="attach-chip"
            v-press
            @tap="removeAttachment(index)"
          >
            <Icon
              col="0"
              :name="attachment.kind === 'image' ? 'image' : 'file'"
              :size="15"
              tone="on-surface-variant"
              class="attach-chip-icon"
            />
            <Label col="1" :text="attachment.name" class="attach-chip-name" />
            <Icon col="2" name="close" :size="13" tone="on-surface-variant" class="attach-chip-x" />
          </GridLayout>
        </WrapLayout>

        <!--
          The trailing button swaps: the microphone while there is nothing
          to send, the send button the moment there is something - and the
          stop button while a reply is on its way. Both are the same width,
          so the text field does not jump when the two trade places.
        -->
        <GridLayout columns="auto, *, auto" class="composer-inner">
          <!-- Attach a photo, one taken now, or a document. -->
          <GridLayout
            col="0"
            columns="auto"
            class="composer-icon-btn"
            v-press
            @tap="openAttachSheet"
          >
            <Icon col="0" name="paperclip" :size="21" tone="on-surface-variant" />
          </GridLayout>

          <TextField
            col="1"
            v-model="userInput"
            hint="Ask anything…"
            class="composer-input"
            :fontSize="Math.round(16 * settings.fontScale)"
            :returnKeyType="settings.sendOnEnter ? 'send' : 'done'"
            @submit="onSubmit"
          />

          <!-- Dictate a message with the voice, while there is nothing to send. -->
          <GridLayout
            v-if="sendState === 'idle'"
            col="2"
            columns="auto"
            class="composer-icon-btn"
            v-press
            @tap="openVoiceChat"
          >
            <Icon col="0" name="microphone" :size="21" tone="on-surface-variant" />
          </GridLayout>

          <!--
            Otherwise the button sends the message, and while a reply is on
            its way it turns into a stop button.
          -->
          <SendButton v-else col="2" :state="sendState" @press="onSendPress" />
        </GridLayout>
      </StackLayout>

      <!-- ============ Drawer ============ -->
      <GridLayout
        v-if="drawerOpen"
        row="0"
        rowSpan="3"
        columns="*"
        class="overlay"
      >
        <Sidebar
          @close="drawerOpen = false"
          @new-chat="onNewChat"
          @open-profile="openProfile"
          @open-settings="openSettings"
        />
      </GridLayout>

      <!-- ============ Model picker ============ -->
      <GridLayout
        v-if="showModelPicker"
        row="0"
        rowSpan="3"
        columns="*"
        class="overlay"
      >
        <ModelSheet
          :models="models"
          :selected="chatStore.model"
          :loading="loadingModels"
          @close="closeModelPicker"
          @select="selectModel"
        />
      </GridLayout>

      <!-- ============ Attachments ============ -->
      <GridLayout
        v-if="showAttachSheet"
        row="0"
        rowSpan="3"
        columns="*"
        class="overlay"
      >
        <AttachSheet @close="showAttachSheet = false" @pick="onAttachPick" />
      </GridLayout>

      <!-- ============ Voice ============ -->
      <GridLayout
        v-if="showVoiceChat"
        row="0"
        rowSpan="3"
        columns="*"
        class="overlay"
      >
        <VoiceSheet @done="onVoiceDone" @close="onVoiceChatClose" />
      </GridLayout>

      <!-- ============ Launch sequence ============ -->
      <GridLayout v-if="showSplash" row="0" rowSpan="3" col="0" class="splash-host">
        <SplashScreen @done="onSplashDone" />
      </GridLayout>
    </GridLayout>
  </Page>
</template>

<style scoped>
.page-root {
  background-color: var(--md-surface);
}

/* ---------- Top app bar ---------- */
/*
  The app bar and the status bar are one band: the system bar is transparent
  and the root view - whose background reaches under it - carries the same
  surface.
*/
.app-bar {
  padding: 4 8;
}

.app-bar-handle {
  horizontal-align: left;
}

/* The chip that shows the active route. */
.route-chip {
  background-color: var(--md-secondary-container);
  border-radius: 8;
  height: 34;
  padding: 0 8;
  margin-left: 4;
  margin-right: 8;
  horizontal-align: left;
  vertical-align: center;
}

.route-chip-dot {
  /* The gap is a margin: the icon sizes itself through its prop, a width in
     the style sheet would be overwritten by it. */
  margin-right: 7;
  vertical-align: center;
}

.route-chip-provider {
  color: var(--md-on-secondary-container);
  font-size: 12;
  font-weight: 500;
  vertical-align: center;
  margin-right: 6;
}

.route-chip-model {
  color: var(--md-on-secondary-container);
  font-size: 13;
  font-weight: 700;
  vertical-align: center;
  margin-right: 3;
}

.status-chip {
  horizontal-align: right;
  vertical-align: center;
  padding-right: 6;
}

.status-text {
  color: var(--md-on-surface-variant);
  font-size: 11;
  font-weight: 600;
  letter-spacing: 0.08;
  text-transform: uppercase;
  vertical-align: center;
}

/* ---------- Conversation ---------- */
.message-scroll {
  background-color: var(--md-surface);
}

.message-list {
  padding: 4 0 8 0;
}

/* ---------- Empty state ---------- */
.hero {
  padding: 44 24 24 24;
}

.hero-mark-wrap {
  margin-bottom: 20;
}

.hero-glow {
  width: 104;
  height: 104;
  horizontal-align: center;
  vertical-align: center;
}

.hero-mark {
  width: 58;
  height: 58;
  horizontal-align: center;
  vertical-align: center;
}

.hero-title {
  color: var(--md-on-surface);
  font-size: 27;
  font-weight: 500;
  letter-spacing: -0.01;
}

.hero-sub {
  color: var(--md-on-surface-variant);
  font-size: 15;
  margin-top: 10;
}

.hero-chips {
  margin-top: 26;
}

.hero-chip {
  color: var(--md-on-surface);
  font-size: 14;
  margin-right: 8;
  margin-bottom: 8;
}

/* ---------- Pending indicator ---------- */
.typing-row {
  padding: 4 16 12 16;
}

.typing-bubble {
  background-color: var(--md-surface-container-high);
  border-radius: 16;
  padding: 14 16;
  horizontal-align: left;
}

.typing-mark {
  margin: 0 3;
}

/* ---------- Composer ---------- */
.composer-area {
  background-color: var(--md-surface-container-low);
  border-top-width: 1;
  border-top-color: var(--md-outline-variant);
  padding: 10 12 12 12;
  horizontal-align: stretch;
}

/* The banner that reports a failed request. */
.error-banner {
  background-color: var(--md-error-container);
  border-radius: 12;
  padding: 12 14;
  margin-bottom: 10;
}

.error-banner-icon {
  margin-right: 10;
  vertical-align: center;
}

.error-banner-text {
  color: var(--md-on-error-container);
  font-size: 13;
  vertical-align: center;
}

.error-banner-action {
  color: var(--md-error);
  font-size: 12;
  font-weight: 700;
  letter-spacing: 0.08;
  vertical-align: center;
  margin-left: 12;
}

/* The files that are waiting to go out with the message. */
.attach-chips {
  margin-bottom: 8;
}

.attach-chip {
  background-color: var(--md-secondary-container);
  border-radius: 8;
  padding: 6 8;
  margin: 0 6 4 0;
}

.attach-chip-icon {
  margin-right: 6;
  vertical-align: center;
}

.attach-chip-name {
  color: var(--md-on-secondary-container);
  font-size: 12;
  font-weight: 600;
  vertical-align: center;
  margin-right: 6;
  max-width: 150;
}

.attach-chip-x {
  vertical-align: center;
}

/* The two icon buttons of the composer: attach, dictate. */
.composer-icon-btn {
  border-radius: 28;
  padding: 12;
  margin-right: 4;
  vertical-align: center;
}

/* A filled text field: the container of the composer. */
.composer-input {
  background-color: var(--md-surface-container-highest);
  color: var(--md-on-surface);
  /* Android takes the colour of the hint from the theme of the platform. */
  placeholder-color: var(--md-on-surface-variant);
  border-radius: 28;
  border-width: 0;
  padding: 0 20;
  height: 56;
  margin-right: 10;
  vertical-align: center;
}

/* ---------- Overlays ---------- */
.overlay {
  horizontal-align: stretch;
  vertical-align: stretch;
}

.splash-host {
  horizontal-align: stretch;
  vertical-align: stretch;
}
</style>
