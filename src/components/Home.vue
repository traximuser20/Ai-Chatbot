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
import { Application, Screen, Utils } from '@nativescript/core';
import { action, inputType, prompt } from '@nativescript/core/ui/dialogs';
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
import ModelUsage from './ModelUsage.vue';
import SplashScreen from './SplashScreen.vue';
import SendButton from './SendButton.vue';
import Icon from './Icon.vue';
import VoiceSheet from './VoiceSheet.vue';
import VoiceChat from './VoiceChat.vue';
import AttachSheet from './AttachSheet.vue';
import { pickImage, pickFile, takePhoto } from '../services/media';
import { speak, stopSpeaking } from '../services/audio';
import { notifyReply } from '../services/notifications';
import { ensureCamera } from '../services/permissions';
import { buildAttachment } from '../utils/attachments';
import type { Attachment, Message } from '../stores/chat';

const chatStore = useChatStore();
const settings = useSettingsStore();
const theme = useThemeStore();
const palette = usePaletteStore();

const userInput = ref('');
const scrollRef = ref(null);
const contentRef = ref(null);
const pageRoot = ref<any>(null);

/** The selected message and the anchor for its action menu. */
const messageMenu = ref<{ message: Message; index: number } | null>(null);
const messageMenuPosition = ref({ left: 16, top: 16 });

/** Places the action menu directly below the long-pressed chat bubble. */
function positionMessageMenu(anchor: any) {
  const root = pageRoot.value?.nativeView;
  if (!root || !anchor?.getLocationInWindow || !root.getLocationInWindow) {
    messageMenuPosition.value = { left: 16, top: 16 };
    return;
  }

  const scale = Screen.mainScreen.scale || 1;
  const rootLocation = root.getLocationInWindow();
  const anchorLocation = anchor.getLocationInWindow();
  const rootWidth = root.getMeasuredWidth() / scale;
  const rootHeight = root.getMeasuredHeight() / scale;
  const anchorBottom = (anchorLocation.y - rootLocation.y + anchor.getMeasuredHeight()) / scale;
  const anchorLeft = (anchorLocation.x - rootLocation.x) / scale;
  const menuWidth = 280;
  const menuHeight = 236;

  messageMenuPosition.value = {
    left: Math.max(8, Math.min(anchorLeft, rootWidth - menuWidth - 8)),
    top: Math.max(8, Math.min(anchorBottom + 8, rootHeight - menuHeight - 8)),
  };
}

const models = ref<OmniAiModel[]>([]);
const showModelPicker = ref(false);
const drawerOpen = ref(false);
const loadingModels = ref(false);

/** The launch sequence plays once, on top of the chat screen. */
const showSplash = ref(true);

/** Suggestions offered on the empty screen. */
const suggestions = [
  'Explain a concept',
  'Help me write',
  'Analyze a photo',
  'Summarize a document',
];

/** Provider prefix of the current model. */
const provider = computed(() => providerOf(chatStore.model));

/** Model name without the provider prefix. */
const modelLabel = computed(() => {
  const slash = chatStore.model.indexOf('/');
  return slash > -1 ? chatStore.model.slice(slash + 1) : chatStore.model;
});

/**
 * Whether the model id carries a provider prefix. `providerOf()` returns the
 * whole id when there is no `/`, so showing the provider as well would print
 * the same name twice and push the capsule past its cap.
 */
const hasProvider = computed(() => chatStore.model.indexOf('/') > -1);

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
/** The file being read - a PDF is rasterised before it can be attached. */
const preparingName = ref('');
/** True while the attach sheet is open. */
const showAttachSheet = ref(false);
/** True while the voice sheet is open for a chat message. */
const showVoiceChat = ref(false);
/** True when the message was dictated, so its reply is read out loud. */
const voiceChatActive = ref(false);
/** True while the full screen voice chat (the wave button) is open. */
const showVoiceMode = ref(false);

/* ------------------------------------------------------------------ */
/* Motion                                                               */
/* ------------------------------------------------------------------ */

/** Elements of the empty state, so they can be animated in. */
const heroMark = ref<any>(null);
const heroTitle = ref<any>(null);
const heroSub = ref<any>(null);
const heroChips = ref<any[]>([]);
const typingDots = ref<any[]>([]);

/**
 * The loops that are currently running.
 *
 * Every loop keeps an animation chain alive, so it has to be stopped when
 * its view goes away - otherwise the chains pile up and eat the heap.
 */
let stopHero: (() => void) | undefined;
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
  stopTyping.forEach((stop) => stop());
  stopHero = undefined;
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

function openModelUsage() {
  drawerOpen.value = false;
  $navigateTo(ModelUsage, { transition: { name: 'slide', duration: 260 } });
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
      // The system picker (SAF) grants access to the chosen file itself, so
      // a media permission is neither needed nor requested here - asking for
      // one would only put a prompt (or a 30 second wait) in front of it.
      picked = await pickImage();
    } else if (source === 'camera') {
      const granted = await ensureCamera();
      if (!granted) {
        lastError.value = 'The camera is off. Allow camera access in Settings to take a photo.';
        return;
      }
      picked = await takePhoto();
    } else {
      picked = await pickFile();
    }

    if (!picked) {
      console.log('[media] pick resolved empty');
      return;
    }
    console.log('[media] picked', picked.name, picked.mime, picked.size, picked.path);

    // Reading a PDF means rasterising its pages, which takes a moment. Let
    // the sheet finish closing and the chip appear before that work starts,
    // so the screen does not look frozen.
    preparingName.value = picked.name;
    lastError.value = '';
    await new Promise((resolve) => setTimeout(resolve, 40));

    const attachment = buildAttachment(picked);
    preparingName.value = '';
    console.log(
      '[media] attachment',
      attachment.name,
      'pages=',
      attachment.pages?.length ?? 0,
      'text=',
      attachment.text?.length ?? 0,
      'reason=',
      attachment.unsupportedReason,
    );

    if (attachment.unsupportedReason) {
      lastError.value = attachment.unsupportedReason;
      return;
    }
    attachments.value = [...attachments.value, attachment];
  } catch (err) {
    preparingName.value = '';
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

/** Opens the full screen voice chat - the wave button of the composer. */
function openVoiceMode() {
  showVoiceMode.value = true;
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

/**
 * Turns an error into something a person can act on.
 *
 * The gateway puts the useful part of a failure in the body of the response,
 * and the client carries the first 200 characters of it into the message.
 * The patterns below map the ones a reader can actually do something about
 * to a sentence that says what to do.
 */
function describeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? '');

  if (/cooling down|model_cooldown|rate.?limit|too many requests|HTTP 429/i.test(message)) {
    return 'That route is rate limited right now. Wait a moment, or pick another route.';
  }

  if (
    /(image|vision|multimodal|file part)/i.test(message) &&
    /(not support|unsupported|capability|reject|invalid|only accept text)/i.test(message)
  ) {
    return 'This route cannot read that attachment. Pick a route with vision, or remove the file.';
  }

  if (/no credentials|missing api key|not configured|no usable|unauthorized|HTTP 401/i.test(message)) {
    return 'That route has no working credentials. Pick another route in the model sheet.';
  }

  if (/context length|too many tokens|too large|payload|HTTP 413/i.test(message)) {
    return 'The message is too large for that route. Try a shorter document or a smaller photo.';
  }

  if (error instanceof OmniAiError && error.status) {
    return `The gateway answered with an error (${error.status}).`;
  }

  if (/Could not reach/i.test(message)) {
    return 'The gateway is unreachable. Check that Omni Ai is running.';
  }

  return 'The request failed. Tap retry to try again.';
}

/** Opens the action menu directly below the long-pressed message bubble. */
function onMessageLongPress(message: Message, index: number, payload?: any) {
  positionMessageMenu(payload?.anchor);
  messageMenu.value = { message, index };
}

/** Runs a choice from the Material 3 action dialog. */
async function selectMessageAction(choice: string) {
  const selected = messageMenu.value;
  messageMenu.value = null;
  if (!selected) {
    return;
  }
  const { message, index } = selected;

  if (choice === 'Copy') {
    Utils.copyToClipboard(message.text);
    return;
  }

  if (choice === 'Delete') {
    chatStore.deleteMessage(index);
    return;
  }

  if (choice === 'Edit') {
    const result = await prompt({
      title: 'Edit message',
      message: 'Change the message text.',
      defaultText: message.text,
      okButtonText: 'Save',
      cancelButtonText: 'Cancel',
      inputType: inputType.text,
    });
    if (result.result && result.text.trim()) {
      chatStore.updateMessage(index, result.text.trim());
    }
    return;
  }

  if (choice === 'Retry') {
    if (message.sender !== 'user' || chatStore.isTyping) {
      return;
    }
    // Retry this exchange, rather than appending a second copy of the old
    // question. Everything from the selected question onward is replaced by
    // the fresh request and its answer.
    const messageAttachments = message.attachments ? [...message.attachments] : [];
    chatStore.truncateMessagesFrom(index);
    userInput.value = message.text;
    attachments.value = messageAttachments;
    await sendMessage();
  }
}

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
    <GridLayout ref="pageRoot" rows="auto, *, auto" class="page-root">
      <!-- ============ Top app bar ============ -->
      <GridLayout row="0" columns="auto, auto, *" class="md-top-bar app-bar">
        <!-- Navigation icon button -->
        <!--
          Material 3: a 48dp touch target around a 24dp glyph, painted with
          `on-surface-variant`. `columns="*"` is what centres the glyph: an
          `auto` track hugs the icon, so the leftover space of the button
          stays unassigned and the glyph lands in its top left corner.
        -->
        <GridLayout
          col="0"
          columns="*"
          rows="*"
          class="md-icon-button app-bar-handle"
          v-press
          @tap="drawerOpen = true"
        >
          <Icon col="0" :name="drawerOpen ? 'close' : 'menu'" :size="24" tone="on-surface-variant" />
        </GridLayout>

        <!-- The name of the app, with its mark. -->
        <GridLayout col="1" columns="auto, auto" class="app-bar-brand">
          <Image col="0" src="~/assets/img/prism-glyph.png" class="app-bar-mark" />
          <Label col="1" text="Omni Ai" class="md-top-bar-title" />
        </GridLayout>

        <!--
          Active route, tucked into the bottom-right corner of the bar. It is
          there on the home screen and through the conversation alike: the
          route is what the app is about, wherever the screen is.
        -->
        <GridLayout
          col="2"
          columns="auto, auto, auto, auto"
          class="route-chip"
          v-press
          @tap="openModelPicker"
        >
          <!--
            The state of the gateway, in the dot that leads the capsule: green
            while it answers, red when it cannot be reached.
          -->
          <Icon
            col="0"
            name="dot"
            :size="8"
            :tone="chatStore.isConnected ? 'live' : 'offline'"
            class="route-chip-dot"
          />
          <Label
            v-if="hasProvider"
            col="1"
            :text="provider"
            class="route-chip-provider"
          />
          <Label col="2" :text="modelLabel" class="route-chip-model" />
          <Icon col="3" name="chevron-down" :size="14" tone="on-secondary-container" />
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
          <Label ref="heroTitle" text="How can I help?" class="hero-title" />
          <Label
            ref="heroSub"
            textWrap="true"
            class="hero-sub"
            text="Type a question, talk it out, or share a photo — I'm ready for anything."
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
          <!--
            Long press is a native gesture, so give it a visible affordance.
            This keeps message actions discoverable without adding another
            control to every bubble.
          -->
          <Label
            text="Press and hold a message for actions"
            class="message-actions-hint"
            textWrap="true"
          />

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
            :selected="messageMenu?.index === index"
            @long-press="onMessageLongPress(message, index, $event)"
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

      <!-- ============ Message actions ============ -->
      <GridLayout
        v-if="messageMenu"
        row="0"
        rowSpan="3"
        columns="*"
        class="message-actions-layer"
        @tap="messageMenu = null"
      >
        <GridLayout
          rows="auto, auto, auto, auto"
          class="message-actions-dialog"
          :left="messageMenuPosition.left"
          :top="messageMenuPosition.top"
          @tap="() => {}"
        >
          <GridLayout row="0" columns="auto, *" class="message-action-item" v-press @tap="selectMessageAction('Copy')">
            <Icon col="0" name="copy" :size="22" tone="on-surface-variant" class="message-action-icon" />
            <Label col="1" text="Copy" class="message-action-label" />
          </GridLayout>
          <GridLayout row="1" columns="auto, *" class="message-action-item" v-press @tap="selectMessageAction('Edit')">
            <Icon col="0" name="edit" :size="22" tone="on-surface-variant" class="message-action-icon" />
            <Label col="1" text="Edit" class="message-action-label" />
          </GridLayout>
          <GridLayout row="2" columns="auto, *" class="message-action-item" v-press @tap="selectMessageAction('Delete')">
            <Icon col="0" name="trash" :size="22" tone="error" class="message-action-icon" />
            <Label col="1" text="Delete" class="message-action-label message-action-label--danger" />
          </GridLayout>
          <GridLayout row="3" columns="auto, *" class="message-action-item" v-press @tap="selectMessageAction('Retry')">
            <Icon col="0" name="retry" :size="22" tone="on-surface-variant" class="message-action-icon" />
            <Label col="1" text="Retry" class="message-action-label" />
          </GridLayout>
        </GridLayout>
      </GridLayout>

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
        <WrapLayout v-if="attachments.length || preparingName" class="attach-chips">
          <!-- The file is being read: a PDF is turned into page images first. -->
          <GridLayout v-if="preparingName" columns="auto, auto" class="attach-chip">
            <Icon col="0" name="file" :size="15" tone="on-surface-variant" class="attach-chip-icon" />
            <Label
              col="1"
              :text="`Reading ${preparingName}…`"
              class="attach-chip-name attach-chip-preparing"
            />
          </GridLayout>

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

          <!--
            While there is nothing to send, the trailing slot carries both
            voice controls: the microphone dictates a message into the field,
            and the wave opens the full screen voice chat. They collapse to
            the send button the moment there is something to send.
          -->
          <StackLayout
            v-if="sendState === 'idle'"
            col="2"
            orientation="horizontal"
            class="composer-actions"
          >
            <GridLayout
              columns="auto"
              class="composer-icon-btn"
              v-press
              @tap="openVoiceChat"
            >
              <Icon col="0" name="microphone" :size="21" tone="on-surface-variant" />
            </GridLayout>
            <GridLayout
              columns="auto"
              class="composer-icon-btn"
              v-press
              @tap="openVoiceMode"
            >
              <Icon col="0" name="wave" :size="21" tone="primary" />
            </GridLayout>
          </StackLayout>

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
          @open-model-usage="openModelUsage"
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

      <!-- ============ Voice chat (the wave button) ============ -->
      <GridLayout
        v-if="showVoiceMode"
        row="0"
        rowSpan="3"
        columns="*"
        class="overlay"
      >
        <VoiceChat @close="showVoiceMode = false" />
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
  border-radius: 24;
}

.app-bar-handle:pressed {
  background-color: var(--md-surface-variant);
}

/* The name of the app: the mark, then the wordmark. */
.app-bar-brand {
  margin-left: 2;
  vertical-align: center;
}

.app-bar-mark {
  width: 28;
  height: 28;
  border-radius: 14;
  margin-right: 10;
  vertical-align: center;
}

/*
  The capsule that picks the route, tucked into the bottom-right corner of the
  bar. The name of the app holds an `auto` column of its own, so the capsule
  can never push it out of view; the caps below bound the capsule in turn.
*/
.route-chip {
  background-color: var(--md-primary);
  border-radius: 16;
  height: 30;
  padding: 0 10;
  margin-right: 4;
  horizontal-align: right;
  vertical-align: bottom;
  /*
    The capsule belongs on the bar's bottom edge, not floating above it. The
    bar's own padding would otherwise leave a gap below it, so the margin
    cancels it: the pill's lower edge lands on the divider of the bar.
  */
  margin-bottom: 7;
}

.route-chip-dot {
  /* The gap is a margin: the icon sizes itself through its prop, a width in
     the style sheet would be overwritten by it. */
  margin-right: 7;
  vertical-align: center;
}

.route-chip-provider {
  color: var(--md-on-primary);
  font-size: 12;
  font-weight: 500;
  vertical-align: center;
  margin-right: 6;
  /* A `Label` honours this, which the capsule's own grid does not: the
     prefix is clipped rather than shoving the name of the app aside. */
  max-width: 46;
}

.route-chip-model {
  color: var(--md-on-primary);
  font-size: 13;
  font-weight: 700;
  vertical-align: center;
  margin-right: 3;
  max-width: 74;
}

/* ---------- Conversation ---------- */
.message-scroll {
  background-color: var(--md-surface);
}

.message-list {
  padding: 4 0 8 0;
}

.message-actions-hint {
  color: var(--md-on-surface-variant);
  font-size: 11;
  text-align: center;
  margin: 0 16 4 16;
  opacity: 0.8;
}

.message-actions-layer {
  horizontal-align: stretch;
  vertical-align: stretch;
}

.message-actions-dialog {
  width: 280;
  background-color: var(--md-surface-container-high);
  border-radius: 28;
  elevation: 6;
  padding: 8;
  horizontal-align: left;
  vertical-align: top;
}

.message-action-item {
  width: 100%;
  min-height: 52;
  border-radius: 26;
  padding: 8 16;
}

.message-action-icon {
  margin-right: 20;
  vertical-align: center;
}

.message-action-label {
  color: var(--md-on-surface);
  font-size: 16;
  vertical-align: center;
}

.message-action-label--danger {
  color: var(--md-error);
}

/* ---------- Empty state ---------- */
.hero {
  padding: 44 24 24 24;
}

.hero-mark-wrap {
  margin-bottom: 20;
}

.hero-glow {
  width: 120;
  height: 120;
  horizontal-align: center;
  vertical-align: center;
}

.hero-mark {
  width: 68;
  height: 68;
  border-radius: 34;
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

.attach-chip-preparing {
  font-style: italic;
  opacity: 0.8;
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

/* The two voice controls that share the trailing slot while the field is empty. */
.composer-actions {
  orientation: horizontal;
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
