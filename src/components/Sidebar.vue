<script lang="ts" setup>
/**
 * The navigation drawer.
 *
 * It is the app's table of contents:
 *   - the gateway identity and its live status
 *   - "New conversation"
 *   - the list of past conversations
 *   - and, at the very end, Profile and Settings
 *
 * The panel slides in from the left over a scrim. The animation is driven
 * with the core `animate` API because NativeScript's CSS engine has no
 * transition support for `translate`.
 */
import { ref, computed, onMounted } from 'vue';
import { useChatStore, type Conversation, formatRelativeTime } from '../stores/chat';
import { useSettingsStore } from '../stores/settings';
import { readableOn } from '../utils/accent';
import Icon from './Icon.vue';

/** Width of the panel in device independent pixels. */
const PANEL_WIDTH = 284;

const emit = defineEmits<{
  close: [];
  newChat: [];
  openProfile: [];
  openSettings: [];
}>();

const props = defineProps<{
  /** Accent colour of the active provider. */
  accent?: string;
}>();

const chatStore = useChatStore();
const settings = useSettingsStore();

const panelRef = ref<any>(null);
const scrimRef = ref<any>(null);

/** Id of the conversation whose delete button is waiting for a confirmation. */
const pendingDeleteId = ref<string | null>(null);

const accent = () => props.accent ?? '#2F55F5';

/** Readable foreground for a surface filled with the accent colour. */
const onAccent = computed(() => readableOn(props.accent ?? '#2F55F5'));

/**
 * Template refs point at the Vue element wrapper, the NativeScript view
 * itself lives behind `nativeView`.
 */
function nativeView(element: any) {
  return element?.nativeView ?? element;
}

onMounted(() => {
  const panel = nativeView(panelRef.value);
  const scrim = nativeView(scrimRef.value);
  if (!panel) {
    return;
  }
  // The panel slides in from the left and settles with a touch of depth,
  // while the scrim fades up underneath it.
  panel.translateX = -PANEL_WIDTH;
  panel.scaleX = 0.97;
  panel.animate(
    { translate: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, duration: 280, curve: 'easeOut' },
  );
  if (scrim) {
    scrim.animate({ opacity: 0, duration: 0 });
    scrim.animate({ opacity: 1, duration: 200 });
  }
});

/** Slides the panel away and then tells the parent to unmount it. */
function close() {
  const panel = nativeView(panelRef.value);
  if (!panel) {
    emit('close');
    return;
  }
  panel
    .animate({
      translate: { x: -PANEL_WIDTH, y: 0 },
      scale: { x: 0.97, y: 1 },
      duration: 220,
      curve: 'easeIn',
    })
    .then(() => emit('close'))
    .catch(() => emit('close'));
}

function onNewChat() {
  pendingDeleteId.value = null;
  emit('newChat');
}

function onOpenConversation(conversation: Conversation) {
  pendingDeleteId.value = null;
  chatStore.openConversation(conversation.id);
  emit('close');
}

/** First tap arms the delete button, the second one removes the conversation. */
function onDelete(conversation: Conversation) {
  if (pendingDeleteId.value === conversation.id) {
    chatStore.deleteConversation(conversation.id);
    pendingDeleteId.value = null;
    return;
  }
  pendingDeleteId.value = conversation.id;
}

function cancelDelete() {
  pendingDeleteId.value = null;
}

/** "3 messages · 7:40 PM" style summary under a conversation title. */
function metaOf(conversation: Conversation): string {
  const count = conversation.messages.length;
  const messages = count === 1 ? '1 message' : `${count} messages`;
  return `${messages} · ${formatRelativeTime(conversation.updatedAt)}`;
}
</script>

<template>
  <GridLayout columns="auto, *" class="drawer">
    <!-- ── Panel ───────────────────────────────────────────────────────── -->
    <GridLayout
      ref="panelRef"
      col="0"
      rows="auto, auto, auto, *, auto"
      class="panel"
    >
      <!-- Gateway identity -->
      <GridLayout row="0" columns="auto, *" class="brand">
        <Image col="0" src="~/assets/img/prism-glyph.png" class="brand-mark" />
        <StackLayout col="1">
          <Label text="Omni Ai" class="brand-name" />
          <Label
            :text="chatStore.isConnected ? 'gateway · live' : 'gateway · offline'"
            class="brand-status"
            :class="{ 'brand-status--offline': !chatStore.isConnected }"
          />
        </StackLayout>
      </GridLayout>

      <!-- New conversation -->
      <GridLayout
        row="1"
        columns="auto, *"
        class="new-chat"
        :backgroundColor="accent()"
        v-press
        @tap="onNewChat"
      >
        <Icon col="0" name="plus" :size="15" :color="onAccent" class="new-chat-mark" />
        <Label col="1" text="New conversation" class="new-chat-text" :color="onAccent" />
      </GridLayout>

      <!-- Section label -->
      <GridLayout row="2" columns="*, auto" class="section">
        <Label col="0" text="Recent" class="section-label" />
        <Label
          v-if="chatStore.history.length"
          col="1"
          :text="`${chatStore.history.length}`"
          class="section-count"
        />
      </GridLayout>

      <!-- Conversation history -->
      <ListView
        v-if="chatStore.history.length"
        row="3"
        class="history"
        :items="chatStore.history"
      >
        <template #default="{ item: conversation }">
          <!--
            `width: 100%` keeps the row inside the panel: a ListView measures
            its items without a width, so a long title would push the delete
            button off the edge of the drawer.
          -->
          <GridLayout columns="*, auto" class="history-row-wrap">
            <GridLayout
              col="0"
              columns="auto, *"
              class="history-row"
              :class="{ 'history-row--active': conversation.id === chatStore.activeConversationId }"
              v-press
              @tap="onOpenConversation(conversation)"
            >
              <Icon col="0" name="dot" :size="7" :color="accent()" class="history-dot" />
              <StackLayout col="1">
                <Label :text="conversation.title" textWrap="true" class="history-title" />
                <Label :text="metaOf(conversation)" class="history-meta" />
              </StackLayout>
            </GridLayout>

            <!-- Delete: first tap arms it, second tap confirms. -->
            <GridLayout
              v-if="pendingDeleteId !== conversation.id"
              col="1"
              columns="auto"
              class="history-delete"
              v-press
              @tap="onDelete(conversation)"
            >
              <Icon col="0" name="trash" :size="15" tone="faint" />
            </GridLayout>
            <StackLayout
              v-else
              col="1"
              orientation="horizontal"
              class="history-confirm"
            >
              <Label text="Delete?" class="history-confirm-label" />
              <Label text="Yes" class="history-confirm-yes" @tap="onDelete(conversation)" />
              <Label text="No" class="history-confirm-no" @tap="cancelDelete" />
            </StackLayout>
          </GridLayout>
        </template>
      </ListView>

      <StackLayout v-else row="3" class="history-empty">
        <Label text="No conversations yet." class="history-empty-title" />
        <Label text="Start one and it will show up here." class="history-empty-text" />
      </StackLayout>

      <!-- Profile + Settings -->
      <GridLayout row="4" rows="auto, auto" class="footer">
        <GridLayout
          row="0"
          columns="auto, *"
          class="footer-row"
          v-press
          @tap="emit('openProfile')"
        >
          <Label col="0" :text="settings.initials" class="footer-avatar" :color="accent()" />
          <Label col="1" text="Profile" class="footer-text" />
        </GridLayout>
        <GridLayout
          row="1"
          columns="auto, *"
          class="footer-row"
          v-press
          @tap="emit('openSettings')"
        >
          <Icon col="0" name="sliders" :size="16" tone="dim" class="footer-mark" />
          <Label col="1" text="Settings" class="footer-text" />
        </GridLayout>
      </GridLayout>
    </GridLayout>

    <!-- ── Scrim ───────────────────────────────────────────────────────── -->
    <GridLayout ref="scrimRef" col="1" class="scrim" @tap="close" />
  </GridLayout>
</template>

<style scoped>
.drawer {
  horizontal-align: stretch;
  vertical-align: stretch;
}

/* ---------- Panel ---------- */
.panel {
  width: 284;
  background-color: var(--app-surface);
  horizontal-align: left;
  vertical-align: stretch;
  padding: 18 0 0 0;
}

/* ---------- Brand ---------- */
.brand {
  padding: 0 20 16 20;
}

.brand-mark {
  width: 26;
  height: 26;
  margin-right: 12;
  vertical-align: center;
}

.brand-name {
  color: var(--app-ink-strong);
  font-size: 17;
  font-weight: 700;
  letter-spacing: -0.015;
}

.brand-status {
  color: var(--app-live);
  font-family: monospace;
  font-size: 10;
  letter-spacing: 0.08;
  margin-top: 2;
}

.brand-status--offline {
  color: var(--app-offline);
}

/* ---------- New conversation ---------- */
.new-chat {
  background-color: var(--app-ink-strong);
  border-radius: 12;
  margin: 0 16 20 16;
  padding: 13 14;
}

.new-chat-mark {
  width: 22;
  vertical-align: center;
  margin-right: 2;
}

.new-chat-text {
  font-size: 15;
  font-weight: 600;
  vertical-align: center;
}

/* ---------- Section label ---------- */
.section {
  padding: 0 20 6 20;
}

.section-label {
  color: var(--app-ink-muted);
  font-family: monospace;
  font-size: 10;
  letter-spacing: 0.14;
  text-transform: uppercase;
}

.section-count {
  color: var(--app-ink-muted);
  font-family: monospace;
  font-size: 10;
  vertical-align: center;
}

/* ---------- History ---------- */
.history {
  background-color: transparent;
  margin-bottom: 8;
}

.history-row-wrap {
  width: 100%;
  padding: 0 12 0 14;
}

.history-row {
  padding: 9 8;
  border-radius: 10;
}

.history-row--active {
  background-color: var(--app-surface-2);
}

/* The dot marks the provider of the conversation. It sits on the first line
   of the title, so it is aligned to the top rather than to the middle of the
   two line block. */
.history-dot {
  vertical-align: top;
  margin-top: 4;
  margin-right: 8;
  opacity: 0.55;
}

.history-title {
  color: var(--app-ink);
  font-size: 14;
}

.history-meta {
  color: var(--app-ink-faint);
  font-family: monospace;
  font-size: 10;
  margin-top: 3;
}

.history-delete {
  width: 32;
  height: 32;
  vertical-align: center;
  padding-right: 4;
}
.history-confirm {
  vertical-align: center;
  padding-right: 6;
}

.history-confirm-label {
  color: var(--app-ink-subtle);
  font-size: 11;
  vertical-align: center;
  margin-right: 6;
}

.history-confirm-yes {
  color: var(--app-danger);
  font-size: 12;
  font-weight: 700;
  vertical-align: center;
  margin-right: 8;
}

.history-confirm-no {
  color: var(--app-ink-dim);
  font-size: 12;
  vertical-align: center;
}

.history-empty {
  padding: 24 20;
}

.history-empty-title {
  color: var(--app-ink-dim);
  font-size: 13;
  font-weight: 600;
}

.history-empty-text {
  color: var(--app-ink-faint);
  font-size: 12;
  margin-top: 3;
}

/* ---------- Footer ---------- */
.footer {
  border-top-width: 1;
  border-top-color: var(--app-border);
  padding: 8 14 16 14;
}

.footer-row {
  padding: 10 8;
}

.footer-mark {
  width: 26;
  vertical-align: center;
}

.footer-avatar {
  font-family: monospace;
  font-size: 10;
  font-weight: 700;
  width: 26;
  height: 26;
  border-radius: 13;
  border-width: 1;
  border-color: var(--app-border-2);
  text-align: center;
  vertical-align: center;
}

.footer-text {
  color: var(--app-ink);
  font-size: 14;
  vertical-align: center;
}

/* ---------- Scrim ---------- */
.scrim {
  background-color: var(--app-scrim);
  horizontal-align: stretch;
  vertical-align: stretch;
}
</style>
