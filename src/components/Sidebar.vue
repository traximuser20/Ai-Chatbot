<script lang="ts" setup>
/**
 * The navigation drawer.
 *
 * Material 3 navigation drawer, the way the Android components draw one:
 *
 * - a `surface-container-low` panel with the end corners rounded, lifted
 *   above the content by a scrim and an elevation;
 * - a header with the name of the app and the state of the gateway;
 * - navigation items of 56dp: a 24dp glyph inside a 56x32 active indicator
 *   (`secondary-container`), then the label in label-large;
 * - "New conversation" as a floating action button docked at the end of the
 *   drawer, 16dp from the edges - the way Gmail docks "Compose";
 * - Profile and Settings as plain navigation items behind a divider.
 */
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useChatStore, type Conversation, formatRelativeTime } from '../stores/chat';
import { useSettingsStore } from '../stores/settings';
import { usePaletteStore } from '../stores/palette';
import { enter, loopAnimation } from '../utils/motion';
import Icon from './Icon.vue';

/** Width of the panel in device independent pixels. */
const PANEL_WIDTH = 312;

const emit = defineEmits<{
  close: [];
  newChat: [];
  openProfile: [];
  openSettings: [];
  openModelUsage: [];
}>();

const chatStore = useChatStore();
const settings = useSettingsStore();
const palette = usePaletteStore();

/**
 * The gradient of the pinned accent, on the floating action button.
 *
 * The button is the one filled surface of the drawer, so it is where a
 * pinned gradient shows. Without one it is null, the binding is dropped,
 * and the painted rule (`var(--md-primary)`) carries the colour of the
 * route, exactly as before.
 */
const newChatGradient = computed(() => palette.accentGradient);

const panelRef = ref<any>(null);
const scrimRef = ref<any>(null);
const headerRef = ref<any>(null);
const sectionRef = ref<any>(null);
const listRef = ref<any>(null);
const fabRef = ref<any>(null);
const footerRef = ref<any>(null);
const statusDotRef = ref<any>(null);

function nativeView(element: any) {
  return element?.nativeView ?? element;
}

/** Whether a conversation is the one on screen - it wears the indicator. */
function isActive(conversation: Conversation): boolean {
  return conversation.id === chatStore.activeConversationId;
}

/*
  Loops have to be stopped again when the drawer goes away - the chain keeps
  the view alive, and a few of them eat the heap (see §7 of the agent rules).
*/
let stopStatusPulse: (() => void) | undefined;

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

  /*
    The contents arrive one after the other, the way Material 3 staggers an
    emphasized entrance: header first, then the subheader, the list, the
    button and the footer - each a beat behind the one before it.
  */
  enter(nativeView(headerRef.value), { delay: 40, distance: 10, duration: 240 });
  enter(nativeView(sectionRef.value), { delay: 90, distance: 8, duration: 220 });
  enter(nativeView(listRef.value), { delay: 130, distance: 10, duration: 260 });
  enter(nativeView(fabRef.value), { delay: 190, distance: 14, duration: 340 });
  enter(nativeView(footerRef.value), { delay: 230, distance: 8, duration: 240 });

  // The dot of the gateway breathes, so the drawer feels alive.
  stopStatusPulse = loopAnimation(
    nativeView(statusDotRef.value),
    [
      { properties: { opacity: 0.45, scale: { x: 0.85, y: 0.85 } }, duration: 900 },
      { properties: { opacity: 1, scale: { x: 1, y: 1 } }, duration: 900 },
    ],
    { delay: 320 }, // after the drawer has landed, so the view is loaded
  );
});

onUnmounted(() => {
  stopStatusPulse?.();
  stopStatusPulse = undefined;
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
      rows="auto, auto, *, auto, auto"
      class="panel"
    >
      <!--
        Header: the mark of the app in a tonal tile, the name in headline
        type, and the state of the gateway as a chip with a live dot.
      -->
      <StackLayout ref="headerRef" row="0" class="header">
        <GridLayout columns="auto, *" class="brand">
          <ContentView col="0" class="brand-tile">
            <Image src="~/assets/img/prism-glyph.png" class="brand-mark" />
          </ContentView>
          <StackLayout col="1" class="brand-content">
            <Label text="Omni Ai" class="brand-name" />
            <GridLayout
              columns="auto, auto"
              class="status-chip"
              :class="{ 'status-chip--offline': !chatStore.isConnected }"
            >
              <Icon
                col="0"
                ref="statusDotRef"
                name="dot"
                :size="8"
                :tone="chatStore.isConnected ? 'live' : 'offline'"
                class="status-dot"
              />
              <Label
                col="1"
                :text="chatStore.isConnected ? 'Gateway live' : 'Gateway offline'"
                class="status-text"
              />
            </GridLayout>
          </StackLayout>
        </GridLayout>
      </StackLayout>

      <!--
        Subheader of the history. It is aligned with the label of an item
        below it (16dp of padding, then the 56dp icon slot), the way Gmail
        aligns its "Recent" header.
      -->
      <GridLayout
        v-if="chatStore.history.length"
        ref="sectionRef"
        row="1"
        columns="*, auto"
        class="section"
      >
        <Label col="0" text="Recent" class="section-label" />
        <Label
          v-if="chatStore.history.length"
          col="1"
          :text="`${chatStore.history.length}`"
          class="section-count"
        />
      </GridLayout>

      <!-- Navigation items: recent conversations. -->
      <ListView
        v-if="chatStore.history.length"
        ref="listRef"
        row="2"
        class="history"
        :items="chatStore.history"
      >
        <template #default="{ item: conversation }">
          <GridLayout columns="*, auto" class="history-row-wrap">
            <GridLayout
              col="0"
              columns="auto, *"
              class="nav-item"
              :class="{ 'nav-item--active': isActive(conversation) }"
              v-press
              @tap="onOpenConversation(conversation)"
            >
              <!--
                The leading glyph, in a 56dp slot. The active indicator is a
                56x32 pill behind it (`secondary-container`), which is what
                marks the selected item in a Material 3 drawer.
              -->
              <GridLayout col="0" columns="*" rows="*" class="nav-slot">
                <ContentView
                  col="0"
                  row="0"
                  class="nav-indicator"
                  :class="{ 'nav-indicator--active': isActive(conversation) }"
                />
                <Icon
                  col="0"
                  row="0"
                  name="dot"
                  :size="isActive(conversation) ? 16 : 10"
                  :tone="isActive(conversation) ? 'on-secondary-container' : 'on-surface-variant'"
                  class="nav-glyph"
                />
              </GridLayout>
              <StackLayout col="1" class="nav-labels">
                <Label :text="conversation.title" textTrimming="end" class="nav-title" />
                <Label :text="metaOf(conversation)" class="nav-meta" />
              </StackLayout>
            </GridLayout>

            <!-- Delete: one tap removes the conversation, with a slide-out. -->
            <GridLayout
              col="1"
              columns="*"
              rows="*"
              class="nav-delete"
              v-press
              @tap="onDelete($event, conversation)"
            >
              <Icon col="0" row="0" name="trash" :size="20" tone="error" class="nav-glyph" />
            </GridLayout>          </GridLayout>
        </template>
      </ListView>

      <!-- Empty state: a tonal tile, then the words. -->
      <StackLayout v-else ref="listRef" row="2" class="history-empty">
        <ContentView class="empty-tile">
          <Icon name="edit" :size="24" tone="primary" />
        </ContentView>
        <Label text="No conversations yet." class="history-empty-title" />
        <Label text="Start one and it will show up here." class="history-empty-text" />
      </StackLayout>

      <!--
        New conversation: a floating action button docked at the end of the
        drawer - 56dp tall, 16dp radius, 16dp from the edges, shadowed.
      -->
      <GridLayout
        ref="fabRef"
        row="3"
        columns="auto, auto"
        class="fab"
        :style="newChatGradient ? { backgroundImage: newChatGradient } : null"
        v-press
        @tap="onNewChat"
      >
        <Icon col="0" name="plus" :size="24" tone="on-primary" class="fab-glyph" />
        <Label col="1" text="New conversation" class="fab-text" />
      </GridLayout>

      <!-- Footer: profile + settings, behind a divider. -->
      <StackLayout ref="footerRef" row="4" class="footer">
        <GridLayout
          columns="auto, *"
          class="nav-item nav-item--single"
          v-press
          @tap="emit('openProfile')"
        >
          <GridLayout col="0" columns="*" rows="*" class="nav-slot">
            <Label col="0" row="0" :text="settings.initials" class="account-mark" />
          </GridLayout>
          <StackLayout col="1" class="nav-labels">
            <Label :text="settings.displayName" class="nav-title nav-title--solo" textTrimming="end" />
            <Label text="Profile" class="nav-meta" />
          </StackLayout>
        </GridLayout>
        <GridLayout
          columns="auto, *"
          class="nav-item nav-item--single"
          v-press
          @tap="emit('openSettings')"
        >
          <GridLayout col="0" columns="*" rows="*" class="nav-slot">
            <Icon col="0" row="0" name="sliders" :size="24" tone="on-surface-variant" class="nav-glyph" />
          </GridLayout>
          <StackLayout col="1" class="nav-labels">
            <Label text="Settings" class="nav-title nav-title--solo" />
            <Label text="Theme, accent, gateway" class="nav-meta" />
          </StackLayout>
        </GridLayout>
        <GridLayout
          columns="auto, *"
          class="nav-item nav-item--single"
          v-press
          @tap="emit('openModelUsage')"
        >
          <GridLayout col="0" columns="*" rows="*" class="nav-slot">
            <Icon col="0" row="0" name="chart" :size="24" tone="on-surface-variant" class="nav-glyph" />
          </GridLayout>
          <Label col="1" text="Model usage" class="nav-title nav-title--solo" />
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
  width: 312;
  background-color: var(--md-surface-container-low);
  horizontal-align: left;
  vertical-align: stretch;
  border-top-right-radius: 16;
  border-bottom-right-radius: 16;
  box-shadow: var(--md-elevation-3);
}

/* ---------- Header ---------- */
.header {
  padding: 20 16 8 16;
}

/* The mark of the app, in a tonal tile. */
.brand-tile {
  width: 44;
  height: 44;
  border-radius: 12;
  background-color: var(--md-surface-container-highest);
}

.brand-mark {
  width: 28;
  height: 28;
  horizontal-align: center;
  vertical-align: center;
}

.brand-content {
  padding-left: 12;
  vertical-align: center;
}

.brand-name {
  color: var(--md-on-surface);
  font-size: 22;
  font-weight: 500;
}

/*
  The state of the gateway, as a chip: a small pill in the container of the
  colour that carries the message - green while the gateway answers, red
  when it cannot be reached.
*/
.status-chip {
  height: 24;
  margin-top: 6;
  padding: 0 10 0 8;
  border-radius: 12;
  background-color: var(--md-secondary-container);
  horizontal-align: left;
  vertical-align: center;
}

.status-chip--offline {
  background-color: var(--md-error-container);
}

.status-dot {
  vertical-align: center;
  margin-right: 6;
}

.status-text {
  color: var(--md-on-secondary-container);
  font-size: 11;
  font-weight: 600;
  vertical-align: center;
}

.status-chip--offline .status-text {
  color: var(--md-on-error-container);
}

/* ---------- Subheader ---------- */
.section {
  padding: 12 16 8 88;
}

.section-label {
  color: var(--md-on-surface-variant);
  font-size: 12;
  font-weight: 600;
  vertical-align: center;
}

/* The count of the section, as a small badge. */
.section-count {
  min-width: 20;
  height: 20;
  padding: 0 6;
  border-radius: 10;
  background-color: var(--md-secondary-container);
  color: var(--md-on-secondary-container);
  font-size: 11;
  font-weight: 600;
  text-align: center;
  vertical-align: center;
  margin-left: 8;
}

/* ---------- Navigation items ---------- */
.history {
  background-color: transparent;
}

/* The item goes edge to edge; its own padding places the icon slot. */
.history-row-wrap {
  width: 100%;
}

.nav-item {
  padding: 0 8 0 16;
  border-radius: 28;
  margin: 1 0;
}

/* Material 3 state layer: a soft overlay while the item is held. */
.nav-item:pressed {
  background-color: var(--md-surface-container-highest);
}

.nav-item--active .nav-title {
  color: var(--md-on-surface);
  font-weight: 600;
}

/* The 56dp slot that holds the glyph - and the indicator behind it. */
.nav-slot {
  width: 56;
  vertical-align: stretch;
}

.nav-indicator {
  width: 56;
  height: 32;
  border-radius: 16;
  background-color: transparent;
  horizontal-align: center;
  vertical-align: center;
}

.nav-indicator--active {
  background-color: var(--md-secondary-container);
}

.nav-glyph {
  horizontal-align: center;
  vertical-align: center;
}

.nav-labels {
  padding: 12 8 12 16;
}

.nav-title {
  color: var(--md-on-surface-variant);
  font-size: 14;
  font-weight: 500;
}

.nav-title--solo {
  vertical-align: center;
  padding-left: 16;
}

.nav-meta {
  color: var(--md-on-surface-variant);
  font-size: 12;
  opacity: 0.7;
  margin-top: 2;
}

/* The trailing delete: a 40dp icon button, quiet until it is needed. */
.nav-delete {
  width: 40;
  height: 40;
  border-radius: 20;
  vertical-align: center;
  margin-right: 4;
  opacity: 0.7;
}

.nav-delete:pressed {
  background-color: var(--md-error-container);
  opacity: 1;
}

/* The initials of the operator, in place of a glyph. */
.account-mark {
  font-size: 13;
  font-weight: 700;
  width: 32;
  height: 32;
  border-radius: 16;
  background-color: var(--md-primary-container);
  color: var(--md-on-primary-container);
  text-align: center;
  vertical-align: center;
  horizontal-align: center;
}

/* ---------- Empty state ---------- */
.history-empty {
  padding: 24 16;
  vertical-align: center;
}

.empty-tile {
  width: 56;
  height: 56;
  border-radius: 16;
  background-color: var(--md-surface-container-high);
  margin-bottom: 12;
  horizontal-align: center;
}

.history-empty-title {
  color: var(--md-on-surface);
  font-size: 14;
  font-weight: 500;
  text-align: center;
}

.history-empty-text {
  color: var(--md-on-surface-variant);
  font-size: 12;
  text-align: center;
  margin-top: 4;
}

/* ---------- The floating action button ---------- */
.fab {
  height: 56;
  border-radius: 16;
  margin: 8 16 16 16;
  padding: 0 20;
  background-color: var(--md-primary);
  box-shadow: var(--md-elevation-3);
  horizontal-align: end;
}

.fab:pressed {
  opacity: 0.88;
}

.fab-glyph {
  vertical-align: center;
}

.fab-text {
  color: var(--md-on-primary);
  font-size: 14;
  font-weight: 600;
  vertical-align: center;
  padding-left: 12;
}

/* ---------- Footer ---------- */
/* An inset divider, the way a Material 3 list separates its sections. */
.footer {
  border-top-width: 1;
  border-top-color: var(--md-outline-variant);
  margin: 0 16 8 16;
  padding-top: 8;
}

/* ---------- Scrim ---------- */
.scrim {
  background-color: var(--md-scrim);
  horizontal-align: stretch;
  vertical-align: stretch;
}
</style>
