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
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { $navigateTo } from 'nativescript-vue';
import { Screen } from '@nativescript/core';
import { useChatStore } from '../stores/chat';
import { useSettingsStore } from '../stores/settings';
import { omniRoute, OmniRouteError, type OmniRouteModel } from '../services/omniroute';
import { accentFor, providerOf } from '../utils/accent';
import ChatMessage from './ChatMessage.vue';
import Sidebar from './Sidebar.vue';
import ModelSheet from './ModelSheet.vue';
import Profile from './Profile.vue';
import Settings from './Settings.vue';
import SplashScreen from './SplashScreen.vue';
import Icon from './Icon.vue';

const chatStore = useChatStore();
const settings = useSettingsStore();

const userInput = ref('');
const scrollRef = ref(null);
const contentRef = ref(null);

const models = ref<OmniRouteModel[]>([]);
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

const statusText = computed(() => (chatStore.isConnected ? 'live' : 'offline'));

/** The request that is currently in flight, so it can be stopped. */
let inFlight: AbortController | undefined;

let unsubscribeStatus: (() => void) | undefined;

onMounted(async () => {
  unsubscribeStatus = omniRoute.onStatus((status) => {
    chatStore.setConnectionStatus(status === 'connected');
  });

  // Probe the gateway so the header shows the real connection state.
  try {
    models.value = await omniRoute.loadModels();
  } catch (err) {
    console.error('Could not load models:', err);
  }
});

onUnmounted(() => {
  unsubscribeStatus?.();
});

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
    models.value = await omniRoute.loadModels(true);
  } catch (err) {
    console.error('Could not load models:', err);
  } finally {
    loadingModels.value = false;
  }
}

function closeModelPicker() {
  showModelPicker.value = false;
}

function selectModel(model: OmniRouteModel) {
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

  try {
    const reply = await omniRoute.sendChat(history, chatStore.model, undefined, controller.signal);
    chatStore.setTypingStatus(false);

    if (reply && reply.trim()) {
      chatStore.addMessage(reply, 'ai');
    } else {
      chatStore.addMessage('(empty response)', 'ai', true);
    }
    scrollToBottom();
    // The layout can still change afterwards (the keyboard closing for
    // example), so make sure the conversation ends up at the newest message.
    setTimeout(() => scrollToBottom(false), 320);
  } catch (error) {
    chatStore.setTypingStatus(false);

    // A cancelled request is not an error - the user pressed stop.
    if (error instanceof OmniRouteError && error.cancelled) {
      return;
    }

    const message =
      error instanceof Error ? error.message : 'Unknown error while contacting OmniRoute.';
    chatStore.addMessage(message, 'ai', true);
    scrollToBottom();
  } finally {
    inFlight = undefined;
  }
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
          <Icon col="0" name="menu" :size="20" color="#14171D" />
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
          <Icon col="3" name="chevron-down" :size="13" color="#9AA1AD" />
        </GridLayout>

        <!-- Gateway state -->
        <GridLayout col="2" columns="auto, auto" class="status-chip">
          <Icon
            col="0"
            name="dot"
            :size="8"
            :color="chatStore.isConnected ? '#0FB6D6' : '#C0392B'"
            :class="{ 'status-dot--live': chatStore.isConnected }"
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
          <GridLayout rows="auto" columns="auto" class="hero-mark-wrap">
            <Image
              row="0"
              col="0"
              src="~/assets/img/prism-glow.png"
              class="hero-glow"
              opacity="0.5"
            />
            <Image row="0" col="0" src="~/assets/img/prism.png" class="hero-mark" />
          </GridLayout>
          <Label text="What should we route?" class="hero-title" />
          <Label
            textWrap="true"
            class="hero-sub"
            :text="`${models.length || 578} models are one tap away. Pick a route, then ask.`"
          />

          <WrapLayout class="hero-chips">
            <Label
              v-for="(suggestion, index) in suggestions"
              :key="suggestion"
              :text="suggestion"
              class="hero-chip"
              :class="`hero-chip--${index}`"
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
              <Label text="●" class="typing-mark typing-mark--1" />
              <Label text="●" class="typing-mark typing-mark--2" />
              <Label text="●" class="typing-mark typing-mark--3" />
            </StackLayout>
          </StackLayout>
        </StackLayout>
      </ScrollView>

      <!-- ============ Composer ============ -->
      <GridLayout row="2" class="composer">
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
          <GridLayout
            col="1"
            columns="auto"
            class="send-button"
            :class="{ 'send-button--idle': !canSend }"
            :backgroundColor="canSend ? accent : '#E6E8ED'"
            @tap="sendMessage"
          >
            <Label col="0" text="↑" class="send-glyph" :color="canSend ? '#FFFFFF' : '#B4BAC4'" />
          </GridLayout>
        </GridLayout>
      </GridLayout>

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
  background-color: #f2f3f6;
}

/* ---------- App bar ---------- */
.header {
  background-color: #ffffff;
  border-bottom-width: 1;
  border-bottom-color: #e9ebef;
  padding: 10 14;
  horizontal-align: stretch;
}

.icon-button {
  color: #14171d;
  font-size: 20;
  width: 34;
  text-align: left;
  vertical-align: center;
}

.route-chip {
  background-color: #f2f3f6;
  border-radius: 14;
  padding: 6 10;
  margin-right: 10;
  horizontal-align: left;
}

.route-chip-dot {
  font-size: 7;
  width: 12;
  vertical-align: center;
}

.route-chip-provider {
  color: #9aa1ad;
  font-family: monospace;
  font-size: 10;
  letter-spacing: 0.1;
  text-transform: uppercase;
  vertical-align: center;
  margin-right: 7;
}

.route-chip-model {
  color: #1b1e24;
  font-family: monospace;
  font-size: 11;
  font-weight: 700;
  vertical-align: center;
  margin-right: 5;
}

.route-chip-caret {
  color: #9aa1ad;
  font-size: 12;
  vertical-align: center;
}

.status-chip {
  horizontal-align: right;
}

.status-dot {
  font-size: 7;
  width: 12;
  vertical-align: center;
}

.status-text {
  color: #9aa1ad;
  font-family: monospace;
  font-size: 10;
  letter-spacing: 0.1;
  text-transform: uppercase;
  vertical-align: center;
}

/* ---------- Conversation ---------- */
.message-scroll {
  background-color: #f2f3f6;
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
  color: #0f1115;
  font-size: 24;
  font-weight: 700;
  letter-spacing: -0.02;
}

.hero-sub {
  color: #8d94a0;
  font-size: 14;
  margin-top: 8;
}

.hero-chips {
  margin-top: 22;
}

.hero-chip {
  background-color: #ffffff;
  border-width: 1;
  border-color: #e2e5ea;
  border-radius: 18;
  color: #3a4049;
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
  background-color: #ffffff;
  border-width: 1;
  border-color: #e6e8ee;
  border-radius: 18;
  padding: 13 16;
  horizontal-align: left;
}

.typing-mark {
  color: #9aa1ad;
  font-size: 11;
  margin: 0 3;
}

/* ---------- Composer ---------- */
.composer {
  background-color: #ffffff;
  border-top-width: 1;
  border-top-color: #e9ebef;
  padding: 10 14 12 14;
  horizontal-align: stretch;
}

.composer-inner {
  columns: *, auto;
}

.composer-input {
  background-color: #f2f3f6;
  color: #14171d;
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
  background-color: #e6e8ed;
}

.send-glyph {
  font-size: 19;
  font-weight: 700;
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
