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
  panel.translate = { x: -PANEL_WIDTH, y: 0 };
  panel.animate({ translate: { x: 0, y: 0 }, duration: 220, easing: 'easeOut' });
  if (scrim) {
    scrim.animate({ opacity: 0, duration: 0 });
    scrim.animate({ opacity: 1, duration: 180 });
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
    .animate({ translate: { x: -PANEL_WIDTH, y: 0 }, duration: 180, easing: 'easeIn' })
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
        <Label col="0" text="◈" class="brand-mark" :color="accent()" />
        <StackLayout col="1">
          <Label text="OmniRoute" class="brand-name" />
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
        @tap="onNewChat"
      >
        <Label col="0" text="✦" class="new-chat-mark" :color="onAccent" />
        <Label col="1" text="New conversation" class="new-chat-text" :color="onAccent" />
      </GridLayout>

      <!-- Section label -->
      <GridLayout row="2" columns="*, auto" class="section">
        <Label col="0" text="Recent" class="section-label" />
        <Label
          v-if="chatStore.conversations.length"
          col="1"
          :text="`${chatStore.conversations.length}`"
          class="section-count"
        />
      </GridLayout>

      <!-- Conversation history -->
      <ListView
        v-if="chatStore.conversations.length"
        row="3"
        class="history"
        :items="chatStore.conversations"
      >
        <template #default="{ item: conversation }">
          <GridLayout columns="*, auto" class="history-row-wrap">
            <GridLayout
              col="0"
              columns="auto, *"
              class="history-row"
              :class="{ 'history-row--active': conversation.id === chatStore.activeConversationId }"
              @tap="onOpenConversation(conversation)"
            >
              <Label col="0" text="●" class="history-dot" :color="accent()" />
              <StackLayout col="1">
                <Label :text="conversation.title" textWrap="true" class="history-title" />
                <Label :text="metaOf(conversation)" class="history-meta" />
              </StackLayout>
            </GridLayout>

            <!-- Delete: first tap arms it, second tap confirms. -->
            <Label
              v-if="pendingDeleteId !== conversation.id"
              col="1"
              text="×"
              class="history-delete"
              @tap="onDelete(conversation)"
            />
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
        <GridLayout row="0" columns="auto, *" class="footer-row" @tap="emit('openProfile')">
          <Label col="0" :text="settings.initials" class="footer-avatar" :color="accent()" />
          <Label col="1" text="Profile" class="footer-text" />
        </GridLayout>
        <GridLayout row="1" columns="auto, *" class="footer-row" @tap="emit('openSettings')">
          <Label col="0" text="⚙" class="footer-mark" />
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
  background-color: #ffffff;
  horizontal-align: left;
  vertical-align: stretch;
  padding: 18 0 0 0;
}

/* ---------- Brand ---------- */
.brand {
  padding: 0 20 16 20;
}

.brand-mark {
  font-size: 22;
  width: 30;
  vertical-align: center;
}

.brand-name {
  color: #0f1115;
  font-size: 17;
  font-weight: 700;
  letter-spacing: -0.015;
}

.brand-status {
  color: #0e8f6e;
  font-family: monospace;
  font-size: 10;
  letter-spacing: 0.08;
  margin-top: 2;
}

.brand-status--offline {
  color: #b3261e;
}

/* ---------- New conversation ---------- */
.new-chat {
  background-color: #14171d;
  border-radius: 12;
  margin: 0 16 20 16;
  padding: 13 14;
}

.new-chat-mark {
  font-size: 14;
  width: 24;
  vertical-align: center;
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
  color: #9aa1ad;
  font-family: monospace;
  font-size: 10;
  letter-spacing: 0.14;
  text-transform: uppercase;
}

.section-count {
  color: #b6bcc6;
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
  padding: 0 12 0 14;
}

.history-row {
  padding: 9 8;
  border-radius: 10;
}

.history-row--active {
  background-color: #f4f5f8;
}

.history-dot {
  font-size: 6;
  width: 14;
  vertical-align: center;
  opacity: 0.55;
}

.history-title {
  color: #1b1e24;
  font-size: 14;
}

.history-meta {
  color: #a2a8b3;
  font-family: monospace;
  font-size: 10;
  margin-top: 3;
}

.history-delete {
  color: #b6bcc6;
  font-size: 20;
  width: 30;
  text-align: center;
  vertical-align: center;
  padding-right: 4;
}

.history-confirm {
  vertical-align: center;
  padding-right: 6;
}

.history-confirm-label {
  color: #8d94a0;
  font-size: 11;
  vertical-align: center;
  margin-right: 6;
}

.history-confirm-yes {
  color: #c0392b;
  font-size: 12;
  font-weight: 700;
  vertical-align: center;
  margin-right: 8;
}

.history-confirm-no {
  color: #6b7280;
  font-size: 12;
  vertical-align: center;
}

.history-empty {
  padding: 24 20;
}

.history-empty-title {
  color: #6b7280;
  font-size: 13;
  font-weight: 600;
}

.history-empty-text {
  color: #a2a8b3;
  font-size: 12;
  margin-top: 3;
}

/* ---------- Footer ---------- */
.footer {
  border-top-width: 1;
  border-top-color: #ecedf1;
  padding: 8 14 16 14;
}

.footer-row {
  padding: 10 8;
}

.footer-mark {
  color: #6b7280;
  font-size: 15;
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
  border-color: #dfe2e8;
  text-align: center;
  vertical-align: center;
}

.footer-text {
  color: #1b1e24;
  font-size: 14;
  vertical-align: center;
}

/* ---------- Scrim ---------- */
.scrim {
  background-color: rgba(12, 14, 18, 0.45);
  horizontal-align: stretch;
  vertical-align: stretch;
}
</style>
