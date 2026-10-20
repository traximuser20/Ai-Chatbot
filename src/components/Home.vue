<script lang="ts" setup>
/**
 * The chat screen.
 *
 * Layout (top to bottom):
 *  - A compact app bar: the drawer handle, the active route as a tappable
 *    chip, and the live state of the gateway.
 *  - A scrollable conversation. Assistant replies are rendered as Markdown,
 *    user messages sit in an ink-filled bubble on the right.
 *  - A composer with a rounded field and an accent send button.
 *
 * Two overlays sit on top of the grid: the navigation drawer and the model
 * picker. Both span all rows so they cover the whole screen.
 */
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { $navigateTo } from 'nativescript-vue';
import { Screen } from '@nativescript/core';
import { useChatStore } from '../stores/chat';
import { useSettingsStore } from '../stores/settings';
import { useThemeStore } from '../stores/theme';
import { omniAi, OmniAiError, type OmniAiModel } from '../services/omni-ai';
import { accentFor, providerOf } from '../utils/accent';
import { enter, loopAnimation } from '../utils/motion';
import { paintStatusBar } from '../utils/status-bar';
import ChatMessage from './ChatMessage.vue';
import Sidebar from './Sidebar.vue';
import ModelSheet from './ModelSheet.vue';
import Profile from './Profile.vue';
import Settings from './Settings.vue';
import SplashScreen from './SplashScreen.vue';
import Icon from './Icon.vue';

const chatStore = useChatStore();
const settings = useSettingsStore();
const theme = useThemeStore();

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

/** Accent colour of the currently selected provider. */
const accent = computed(() => accentFor(chatStore.model));

/** Provider prefix of the current model. */
const provider = computed(() => providerOf(chatStore.model));

/** Model name without the provider prefix. */
const modelLabel = computed(() => {
  const slash = chatStore.model.indexOf('/');
  return slash > -1 ? chatStore.model.slice(slash + 1) : chatStore.model;
});

const canSend = computed(() => userInput.value.trim().length > 0 && !chatStore.isTyping);

/**
 * The fill of the send button.
 *
 * The button is painted with a property rather than with a rule, because the
 * accent of the provider is a runtime value. The two other states - idle and
 * waiting for the answer - come from the palette, so they follow the theme.
 */
const sendButtonBackground = computed(() => {
  if (chatStore.isTyping) {
    return theme.palette.danger;
  }
  if (canSend.value) {
    return accent.value;
  }
  return theme.palette.surface3;
});

const statusText = computed(() => (chatStore.isConnected ? 'live' : 'offline'));

/** The request that is currently in flight, so it can be stopped. */
let inFlight: AbortController | undefined;

/** The message that failed, so it can be sent again. */
let failedText = '';

/** A short, actionable description of the last failure. */
const lastError = ref('');

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
const sendButton = ref<any>(null);

/**
 * The loops that are currently running.
 *
 * Every loop keeps an animation chain alive, so it has to be stopped when
 * its view goes away - otherwise the chains pile up and eat the heap.
 */
let stopHero: (() => void) | undefined;
let stopLive: (() => void) | undefined;
let stopBusy: (() => void) | undefined;
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

/** The three dots hop while the answer is on its way. */
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

/** The send button throbs while it waits for the answer. */
function startBusyLoop() {
  stopBusy = loopAnimation(sendButton.value?.nativeView, [
    { properties: { scale: { x: 1.06, y: 1.06 } }, duration: 800 },
    { properties: { scale: { x: 1, y: 1 } }, duration: 800 },
  ]);
}

/** Stops every loop that is running. */
function stopAllLoops() {
  stopHero?.();
  stopLive?.();
  stopBusy?.();
  stopTyping.forEach((stop) => stop());
  stopHero = undefined;
  stopLive = undefined;
  stopBusy = undefined;
  stopTyping = [];
}

let unsubscribeStatus: (() => void) | undefined;

onMounted(async () => {
  unsubscribeStatus = omniAi.onStatus((status) => {
    chatStore.setConnectionStatus(status === 'connected');
  });

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
});

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

// The dots only hop while a reply is on its way, and the send button
// breathes to show that something is happening.
watch(
  () => chatStore.isTyping,
  (typing) => {
    if (typing) {
      nextTick(() => {
        startTypingDots();
        startBusyLoop();
      });
    } else {
      stopBusy?.();
      stopBusy = undefined;
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

function onSubmit() {
  if (settings.sendOnEnter) {
    sendMessage();
  }
}

async function sendMessage() {
  const text = userInput.value.trim();
  if (!text || chatStore.isTyping) {
    return;
  }

  userInput.value = '';
  chatStore.addMessage(text, 'user');
  chatStore.setTypingStatus(true);
  scrollToBottom();

  const history = chatStore.buildHistory(
    'You are a helpful assistant. Answer concisely and use Markdown.',
  );

  const controller = new AbortController();
  inFlight = controller;
  failedText = text;

  try {
    const reply = await omniAi.sendChat(history, chatStore.model, undefined, controller.signal);
    chatStore.setTypingStatus(false);
    lastError.value = '';

    if (reply && reply.trim()) {
      chatStore.addMessage(reply, 'ai');
    } else {
      lastError.value = 'The gateway answered with an empty reply.';
    }
    scrollToBottom();
    // The layout can still change afterwards (the keyboard closing for
    // example), so make sure the conversation ends up at the newest message.
    setTimeout(() => scrollToBottom(false), 320);
  } catch (error) {
    chatStore.setTypingStatus(false);

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
  sendMessage();
}

/** Stops the request that is currently in flight. */
function stopGenerating() {
  inFlight?.abort();
}
</script>

<template>
  <Page actionBarHidden="true">
    <GridLayout rows="auto, *, auto" class="page-root">
      <!-- ============ App bar ============ -->
      <GridLayout row="0" columns="auto, *, auto" class="header">
        <!-- Drawer handle -->
        <GridLayout
          col="0"
          columns="auto"
          class="icon-button"
          v-press
          @tap="drawerOpen = true"
        >
          <Icon col="0" name="menu" :size="20" tone="ink" />
        </GridLayout>

        <!-- Active route: tapping it opens the model picker. -->
        <GridLayout
          col="1"
          columns="auto, auto, auto, auto"
          class="route-chip"
          v-press
          @tap="openModelPicker"
        >
          <Icon col="0" name="dot" :size="8" :color="accent" class="route-chip-dot" />
          <Label col="1" :text="provider" class="route-chip-provider" />
          <Label col="2" :text="modelLabel" class="route-chip-model" />
          <Icon col="3" name="chevron-down" :size="13" tone="muted" />
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
        <!-- Empty state -->
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
              class="hero-chip"
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
            :accent="accent"
            :scale="settings.fontScale"
            :show-timestamp="settings.showTimestamps"
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
                tone="muted"
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
        <GridLayout v-if="lastError" columns="auto, *, auto" class="error-bar">
          <Icon col="0" name="warning" :size="13" tone="danger" class="error-bar-dot" />
          <Label col="1" :text="lastError" textWrap="true" class="error-bar-text" />
          <GridLayout col="2" columns="auto" class="error-bar-action-wrap" v-press @tap="retryLastMessage">
            <Icon col="0" name="retry" :size="12" tone="danger" class="error-bar-action-icon" />
            <Label col="1" text="Retry" class="error-bar-action" />
          </GridLayout>
        </GridLayout>

        <GridLayout columns="*, auto" class="composer-inner">
          <TextField
            col="0"
            v-model="userInput"
            hint="Ask anything…"
            class="composer-input"
            :fontSize="Math.round(15 * settings.fontScale)"
            :returnKeyType="settings.sendOnEnter ? 'send' : 'done'"
            @submit="onSubmit"
          />
          <!--
            The button does double duty: it sends the message, and while a
            reply is on its way it turns into a stop button.
          -->
          <GridLayout
            ref="sendButton"
            col="1"
            columns="auto"
            class="send-button"
            :class="{ 'send-button--idle': !canSend }"
            :backgroundColor="sendButtonBackground"
            v-press
            @tap="chatStore.isTyping ? stopGenerating() : sendMessage()"
          >
            <GridLayout col="0" columns="auto" class="send-glyph-wrap">
              <Icon
                v-if="!chatStore.isTyping"
                name="arrow-up"
                :size="17"
                :tone="canSend ? 'on-accent' : 'faint'"
              />
              <Icon v-else name="stop" :size="15" tone="on-accent" />
            </GridLayout>
          </GridLayout>
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
          :accent="accent"
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
          :accent="accent"
          @close="closeModelPicker"
          @select="selectModel"
        />
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
background-color: var(--app-canvas);
}

/* ---------- App bar ---------- */
.header {
background-color: var(--app-surface);
  border-bottom-width: 1;
border-bottom-color: var(--app-border);
  padding: 10 14;
  horizontal-align: stretch;
}

.icon-button {
  width: 34;
  height: 34;
  horizontal-align: left;
  vertical-align: center;
  padding-left: 2;
}

.route-chip {
background-color: var(--app-canvas);
  border-radius: 14;
  padding: 6 10;
  margin-right: 10;
  horizontal-align: left;
}

.route-chip-dot {
  /* The gap is a margin: the icon sizes itself through its prop, a width in
     the style sheet would be overwritten by it. */
  margin-right: 6;
  vertical-align: center;
}

.route-chip-provider {
color: var(--app-ink-muted);
  font-family: monospace;
  font-size: 10;
  letter-spacing: 0.1;
  text-transform: uppercase;
  vertical-align: center;
  margin-right: 7;
}

.route-chip-model {
color: var(--app-ink);
  font-family: monospace;
  font-size: 11;
  font-weight: 700;
  vertical-align: center;
  margin-right: 5;
}

.status-chip {
  horizontal-align: right;
}

.status-text {
color: var(--app-ink-muted);
  font-family: monospace;
  font-size: 10;
  letter-spacing: 0.1;
  text-transform: uppercase;
  vertical-align: center;
}

/* The live indicator breathes while the gateway is reachable. */
.status-dot--live {
  animation-name: livePulse;
  animation-duration: 2200ms;
  animation-iteration-count: infinite;
  animation-timing-function: ease-in-out;
}

/* ---------- Conversation ---------- */
.message-scroll {
background-color: var(--app-canvas);
}

.message-list {
  padding-bottom: 12;
}

/* ---------- Empty state ---------- */
.hero {
  padding: 36 26 24 26;
}

.hero-mark-wrap {
  margin-bottom: 14;
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
color: var(--app-ink-strong);
  font-size: 24;
  font-weight: 700;
  letter-spacing: -0.02;
}

.hero-sub {
color: var(--app-ink-subtle);
  font-size: 14;
  margin-top: 8;
}

.hero-chips {
  margin-top: 22;
}

.hero-chip {
background-color: var(--app-surface);
  border-width: 1;
border-color: var(--app-border-2);
  border-radius: 18;
color: var(--app-ink);
  font-size: 13;
  padding: 9 14;
  margin-right: 8;
  margin-bottom: 8;
}

/* ---------- Pending indicator ---------- */
.typing-row {
  padding: 4 16 8 16;
}

.typing-bubble {
background-color: var(--app-surface);
  border-width: 1;
  border-color: var(--app-border);
  border-radius: 18;
  padding: 13 16;
  horizontal-align: left;
}

.typing-mark {
  margin: 0 3;
}

/* ---------- Composer ---------- */
.composer-area {
background-color: var(--app-surface);
  border-top-width: 1;
border-top-color: var(--app-border);
  padding: 10 14 12 14;
  horizontal-align: stretch;
}

/* The banner that reports a failed request. */
.error-bar {
background-color: var(--app-danger-bg);
  border-left-width: 3;
border-left-color: var(--app-danger);
  border-radius: 8;
  padding: 10 12;
  margin-bottom: 10;
}

.error-bar-dot {
  margin-right: 4;
  vertical-align: top;
  margin-top: 3;
}

.error-bar-text {
color: var(--app-danger-ink);
  font-size: 13;
  vertical-align: center;
}

.error-bar-action-wrap {
  margin-left: 12;
  vertical-align: center;
}

.error-bar-action-icon {
  margin-right: 5;
  vertical-align: center;
}

.error-bar-action {
color: var(--app-danger);
  font-size: 13;
  font-weight: 700;
  vertical-align: center;
}

.composer-inner {
  columns: *, auto;
}

.composer-input {
background-color: var(--app-canvas);
color: var(--app-ink);
  border-radius: 22;
  border-width: 0;
  padding: 12 18;
  margin-right: 10;
  vertical-align: center;
}

.send-button {
  width: 42;
  height: 42;
  border-radius: 21;
  horizontal-align: right;
  vertical-align: center;
}

.send-button--idle {
background-color: var(--app-surface-3);
}

.send-glyph-wrap {
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
