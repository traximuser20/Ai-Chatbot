<script lang="ts" setup>
/**
 * The navigation drawer.
 *
 * Material 3 navigation drawer: a lifted surface with a rounded trailing
 * edge, a brand header, a filled "new conversation" action, a list of past
 * conversations as navigation items (each with a leading indicator and an
 * active pill), and Profile / Settings at the bottom behind a divider.
 */
import { ref, onMounted } from 'vue';
import { useChatStore, type Conversation, formatRelativeTime } from '../stores/chat';
import { useSettingsStore } from '../stores/settings';
import Icon from './Icon.vue';

/** Width of the panel in device independent pixels. */
const PANEL_WIDTH = 300;

const emit = defineEmits<{
  close: [];
  newChat: [];
  openProfile: [];
  openSettings: [];
}>();

const chatStore = useChatStore();
const settings = useSettingsStore();

const panelRef = ref<any>(null);
const scrimRef = ref<any>(null);

function nativeView(element: any) {
  return element?.nativeView ?? element;
}

onMounted(() => {
  const panel = nativeView(panelRef.value);
  const scrim = nativeView(scrimRef.value);
  if (!panel) {
    return;
  }
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
  emit('newChat');
}

function onOpenConversation(conversation: Conversation) {
  chatStore.openConversation(conversation.id);
  emit('close');
}

/**
 * Deletes a conversation straight away - no confirmation. The row slides
 * out and fades, then the store drops it once the animation is done.
 */
function onDelete(event: any, conversation: Conversation) {
  const tapped = event?.object ?? event;
  const row = rowFor(tapped) ?? tapped;
  const remove = () => chatStore.deleteConversation(conversation.id);

  if (!row || typeof row.animate !== 'function') {
    remove();
    return;
  }

  // The ListView recycles its rows, so the animation has to be undone before
  // the store drops the item - otherwise the next conversation to reuse this
  // view would appear faded and pushed out to the left.
  const reset = () => {
    row.opacity = 1;
    row.translateX = 0;
    remove();
  };

  row
    .animate({ opacity: 0, translate: { x: -60, y: 0 }, duration: 200, curve: 'easeIn' })
    .then(reset)
    .catch(reset);
}

/**
 * The root of the item that holds a view. A tap can be raised on the delete
 * button or on the glyph inside it, so the row is found by walking up the
 * tree rather than by taking one parent.
 */
function rowFor(view: any) {
  let node = view;
  while (node) {
    const classes = typeof node.className === 'string' ? node.className.split(/\s+/) : [];
    if (classes.includes('history-row-wrap')) {
      return node;
    }
    node = node.parent;
  }
  return null;
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
      rows="auto, auto, *, auto"
      class="panel"
    >
      <!-- Header: brand + gateway status + new conversation. -->
      <StackLayout row="0" class="header">
        <GridLayout columns="auto, *" class="brand">
          <Image col="0" src="~/assets/img/prism-glyph.png" class="brand-mark" />
          <StackLayout col="1" class="brand-content">
            <Label text="Omni Ai" class="brand-name" />
            <Label
              :text="chatStore.isConnected ? 'gateway · live' : 'gateway · offline'"
              class="brand-status"
              :class="{ 'brand-status--offline': !chatStore.isConnected }"
            />
          </StackLayout>
        </GridLayout>

        <!-- New conversation: a filled action button. -->
        <GridLayout
          columns="auto, *"
          class="new-chat"
          v-press
          @tap="onNewChat"
        >
          <Icon col="0" name="plus" :size="20" tone="on-primary" class="new-chat-mark" />
          <Label col="1" text="New conversation" class="new-chat-text" />
        </GridLayout>
      </StackLayout>

      <!-- Section label. -->
      <GridLayout row="1" columns="*, auto" class="section">
        <Label col="0" text="Recent" class="section-label" />
        <Label
          v-if="chatStore.history.length"
          col="1"
          :text="`${chatStore.history.length}`"
          class="section-count"
        />
      </GridLayout>

      <!-- Navigation list: recent conversations. -->
      <ListView
        v-if="chatStore.history.length"
        row="2"
        class="history"
        :items="chatStore.history"
      >
        <template #default="{ item: conversation }">
          <GridLayout columns="*, auto" class="history-row-wrap">
            <GridLayout
              col="0"
              columns="auto, *"
              class="history-row"
              :class="{ 'history-row--active': conversation.id === chatStore.activeConversationId }"
              v-press
              @tap="onOpenConversation(conversation)"
            >
              <Icon
                col="0"
                name="dot"
                :size="10"
                :tone="conversation.id === chatStore.activeConversationId ? 'on-secondary-container' : 'primary'"
                class="history-dot"
              />
              <StackLayout col="1" class="history-content">
                <Label :text="conversation.title" textWrap="true" class="history-title" />
                <Label :text="metaOf(conversation)" class="history-meta" />
              </StackLayout>
            </GridLayout>

            <!-- Delete: one tap removes the conversation, with a slide-out. -->
            <GridLayout
              col="1"
              columns="auto"
              class="history-delete"
              v-press
              @tap="onDelete($event, conversation)"
            >
              <Icon col="0" name="trash" :size="18" tone="error" />
            </GridLayout>
          </GridLayout>
        </template>
      </ListView>

      <StackLayout v-else row="2" class="history-empty">
        <Label text="No conversations yet." class="history-empty-title" />
        <Label text="Start one and it will show up here." class="history-empty-text" />
      </StackLayout>

      <!-- Footer: profile + settings, behind a divider. -->
      <StackLayout row="3" class="footer">
        <GridLayout
          columns="auto, *"
          class="footer-row"
          v-press
          @tap="emit('openProfile')"
        >
          <Label col="0" :text="settings.initials" class="footer-avatar" />
          <Label col="1" text="Profile" class="footer-text" />
        </GridLayout>
        <GridLayout
          columns="auto, *"
          class="footer-row"
          v-press
          @tap="emit('openSettings')"
        >
          <Icon col="0" name="sliders" :size="20" tone="on-surface-variant" class="footer-mark" />
          <Label col="1" text="Settings" class="footer-text" />
        </GridLayout>
      </StackLayout>
    </GridLayout>

    <!-- ── Scrim ───────────────────────────────────────────────────────── -->
    <GridLayout ref="scrimRef" col="1" class="scrim" @tap="close" />
  </GridLayout>
</template>

<style scoped>
/* ---------- Drawer ---------- */
.drawer {
  horizontal-align: stretch;
  vertical-align: stretch;
}

/* ---------- Panel ---------- */
.panel {
  width: 300;
  background-color: var(--md-surface-container-low);
  horizontal-align: left;
  vertical-align: stretch;
  border-top-right-radius: 28;
  border-bottom-right-radius: 28;
  box-shadow: var(--md-elevation-3);
}

/* ---------- Header ---------- */
.header {
  padding: 12 0 0 0;
}

.brand {
  padding: 8 20 12 20;
}

.brand-mark {
  width: 36;
  height: 36;
  vertical-align: center;
}

.brand-content {
  padding-left: 14;
}

.brand-name {
  color: var(--md-on-surface);
  font-size: 22;
  font-weight: 500;
  letter-spacing: -0.01;
}

.brand-status {
  color: var(--md-live);
  font-size: 12;
  font-weight: 500;
  letter-spacing: 0.02;
  margin-top: 2;
}

.brand-status--offline {
  color: var(--md-error);
}

/* ---------- New conversation ---------- */
.new-chat {
  background-color: var(--md-primary);
  border-radius: 16;
  margin: 4 16 12 16;
  padding: 0 20;
  height: 52;
  box-shadow: var(--md-elevation-1);
}

.new-chat-mark {
  vertical-align: center;
}

.new-chat-text {
  color: var(--md-on-primary);
  font-size: 15;
  font-weight: 600;
  vertical-align: center;
  padding-left: 12;
}

/* ---------- Section label ---------- */
.section {
  padding: 8 28 8 28;
}

.section-label {
  color: var(--md-on-surface-variant);
  font-size: 11;
  font-weight: 600;
  letter-spacing: 0.08;
  text-transform: uppercase;
}

.section-count {
  color: var(--md-on-surface-variant);
  font-size: 11;
  vertical-align: center;
}

/* ---------- History ---------- */
.history {
  background-color: transparent;
}

.history-row-wrap {
  width: 100%;
  padding: 4 12 4 12;
}

.history-row {
  padding: 10 16;
  border-radius: 28;
}

.history-row--active {
  background-color: var(--md-secondary-container);
}

.history-dot {
  vertical-align: center;
}

.history-content {
  padding-left: 12;
}

.history-title {
  color: var(--md-on-surface);
  font-size: 14;
  font-weight: 500;
}

.history-row--active .history-title {
  color: var(--md-on-secondary-container);
}

.history-meta {
  color: var(--md-on-surface-variant);
  font-size: 11;
  margin-top: 2;
}

.history-row--active .history-meta {
  color: var(--md-on-secondary-container);
  opacity: 0.8;
}

.history-delete {
  width: 44;
  height: 44;
  vertical-align: center;
  padding-right: 4;
}

.history-empty {
  padding: 24 28;
}

.history-empty-title {
  color: var(--md-on-surface-variant);
  font-size: 14;
  font-weight: 500;
}

.history-empty-text {
  color: var(--md-outline);
  font-size: 12;
  margin-top: 4;
}

/* ---------- Footer ---------- */
.footer {
  border-top-width: 1;
  border-top-color: var(--md-outline-variant);
  padding: 8 12 16 12;
}

.footer-row {
  padding: 10 12;
  border-radius: 28;
}

.footer-avatar {
  font-size: 12;
  font-weight: 700;
  width: 32;
  height: 32;
  border-radius: 16;
  background-color: var(--md-primary-container);
  color: var(--md-on-primary-container);
  text-align: center;
  vertical-align: center;
}

.footer-mark {
  vertical-align: center;
}

.footer-text {
  color: var(--md-on-surface);
  font-size: 14;
  font-weight: 500;
  vertical-align: center;
  padding-left: 12;
}

/* ---------- Scrim ---------- */
.scrim {
  background-color: var(--md-scrim);
  horizontal-align: stretch;
  vertical-align: stretch;
}
</style>