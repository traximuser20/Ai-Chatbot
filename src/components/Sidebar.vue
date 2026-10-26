<script lang="ts" setup>
/**
 * The navigation drawer.
 *
 * Material 3 modal navigation drawer:
 *
 * - `surface-container-low` panel, end corners at 16dp, elevation-1 shadow
 *   and a `--md-scrim` overlay behind it;
 * - header: 28dp top inset, brand tile + wordmark + gateway status chip;
 * - extended FAB ("New conversation") with full-bleed gradient support;
 * - section subheader at 72dp left (aligned to the label column) + count badge;
 * - navigation items: 56dp tall, 48×28dp `secondary-container` indicator pill,
 *   24dp glyph centred in the slot, `label-large` (14/500) text;
 * - trailing delete: 40dp icon button, quiet until pressed;
 * - footer nav items (Profile · Settings · Model usage) share the same item
 *   structure, separated by a 1dp outline-variant hairline.
 */
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { Screen } from '@nativescript/core';
import { useChatStore, type Conversation, formatRelativeTime } from '../stores/chat';
import { useSettingsStore } from '../stores/settings';
import { usePaletteStore } from '../stores/palette';
import { enter, loopAnimation } from '../utils/motion';
import Icon from './Icon.vue';

/** Width of the panel in dp. Material 3 modal drawer: min(360, screen − 56). */
const screenWidthDp = Screen.mainScreen.widthPixels / (Screen.mainScreen.scale || 1);
const PANEL_WIDTH = Math.min(280, Math.round(screenWidthDp - 80));

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
 * Gradient for the extended FAB when the accent is pinned.
 * Falls back to `var(--md-primary)` via CSS when null.
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
  if (element && typeof element.animate === 'function') return element;
  const nested = element?.nativeView;
  if (nested && typeof nested.animate === 'function') return nested;
  return null;
}

function isActive(conversation: Conversation): boolean {
  return conversation.id === chatStore.activeConversationId;
}

let stopStatusPulse: (() => void) | undefined;

onMounted(() => {
  const panel = nativeView(panelRef.value);
  const scrim = nativeView(scrimRef.value);
  if (!panel) return;

  /* Slide-in entrance. */
  panel.translateX = -PANEL_WIDTH;
  panel.scaleX = 0.97;
  panel.animate({ translate: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, duration: 280, curve: 'easeOut' });

  if (scrim) {
    scrim.animate({ opacity: 0, duration: 0 });
    scrim.animate({ opacity: 1, duration: 200 });
  }

  /* Staggered content entrance — header → section → list → FAB → footer. */
  enter(nativeView(headerRef.value),  { delay:  40, distance: 10, duration: 240 });
  enter(nativeView(sectionRef.value), { delay:  90, distance:  8, duration: 220 });
  enter(nativeView(listRef.value),    { delay: 130, distance: 10, duration: 260 });
  enter(nativeView(fabRef.value),     { delay: 190, distance: 14, duration: 340 });
  enter(nativeView(footerRef.value),  { delay: 230, distance:  8, duration: 240 });

  /* Breathing dot — the gateway feels alive. */
  stopStatusPulse = loopAnimation(
    nativeView(statusDotRef.value),
    [
      { properties: { opacity: 0.45, scale: { x: 0.85, y: 0.85 } }, duration: 900 },
      { properties: { opacity: 1,    scale: { x: 1,    y: 1    } }, duration: 900 },
    ],
    { delay: 320 },
  );
});

onUnmounted(() => {
  stopStatusPulse?.();
  stopStatusPulse = undefined;
});

function close() {
  const panel = nativeView(panelRef.value);
  if (!panel) { emit('close'); return; }
  panel
    .animate({ translate: { x: -PANEL_WIDTH, y: 0 }, scale: { x: 0.97, y: 1 }, duration: 220, curve: 'easeIn' })
    .then(() => emit('close'))
    .catch(() => emit('close'));
}

function onNewChat() { emit('newChat'); }

function onOpenConversation(conversation: Conversation) {
  chatStore.openConversation(conversation.id);
  emit('close');
}

/**
 * Slide-out + fade → store deletion, with row-state reset so ListView
 * recycling does not ghost the animation onto the next item.
 */
function onDelete(event: any, conversation: Conversation) {
  const tapped = event?.object ?? event;
  const row    = rowFor(tapped) ?? tapped;
  const remove = () => chatStore.deleteConversation(conversation.id);

  if (!row || typeof row.animate !== 'function') { remove(); return; }

  const reset = () => { row.opacity = 1; row.translateX = 0; remove(); };
  row.animate({ opacity: 0, translate: { x: -60, y: 0 }, duration: 200, curve: 'easeIn' })
     .then(reset).catch(reset);
}

function rowFor(view: any) {
  let node = view;
  while (node) {
    const classes = typeof node.className === 'string' ? node.className.split(/\s+/) : [];
    if (classes.includes('history-row-wrap')) return node;
    node = node.parent;
  }
  return null;
}

function metaOf(conversation: Conversation): string {
  const count = conversation.messages.length;
  return `${count === 1 ? '1 message' : `${count} messages`} · ${formatRelativeTime(conversation.updatedAt)}`;
}
</script>

<template>
  <GridLayout columns="auto, *" class="drawer">
    <!-- ── Panel ─────────────────────────────────────────────────────── -->
    <!--
      Material 3 modal navigation drawer:
        surface-container-low · end corners 16dp · elevation-1 shadow.
      rows: header | top-divider | extended-FAB | bottom-divider |
            section-subheader | history list (* = flex) | footer.
    -->
    <GridLayout
      ref="panelRef"
      col="0"
      rows="auto, auto, auto, auto, auto, *, auto"
      class="panel"
      :style="{ width: PANEL_WIDTH }"
    >
      <!--
        Header: 28dp top inset (M3 spec), brand tile (48×48, shape-M) +
        wordmark (title-large 22/600) + gateway status chip.
      -->
      <StackLayout ref="headerRef" row="0" class="header">
        <GridLayout columns="auto, *" class="brand">
          <ContentView col="0" class="brand-tile">
            <Image src="~/assets/img/prism-glyph.png" class="brand-mark" />
          </ContentView>
          <StackLayout col="1" class="brand-content">
            <Label text="Omni Ai" class="brand-name" />
            <!-- Gateway status chip: secondary-container or error-container. -->
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

      <!-- Hairline between the header and the extended FAB (row 1). -->
      <GridLayout row="1" columns="*" class="drawer-divider">
        <ContentView class="drawer-divider-line" />
      </GridLayout>

      <!--
        "New conversation" action button (row 2).
        Material 3 compact pill button: 44dp height, 22dp corner radius,
        content-width with auto columns, left-aligned with a 16dp margin.
      -->
      <GridLayout
        ref="fabRef"
        row="2"
        columns="auto, auto"
        class="fab"
        :style="newChatGradient ? { backgroundImage: newChatGradient } : null"
        v-press
        @tap="onNewChat"
      >
        <Icon col="0" name="plus" :size="20" tone="on-primary" class="fab-icon" />
        <Label col="1" text="New conversation" class="fab-label" />
      </GridLayout>

      <!-- Hairline between the extended FAB and the history (row 3). -->
      <GridLayout row="3" columns="*" class="drawer-divider">
        <ContentView class="drawer-divider-line" />
      </GridLayout>

      <!--
        Section subheader — "Recent" (row 4).
        Left edge at 28dp, aligned with the panel header.
        Count badge: 20dp pill in secondary-container.
      -->
      <GridLayout
        v-if="chatStore.history.length"
        ref="sectionRef"
        row="4"
        columns="*, auto"
        class="section"
      >
        <Label col="0" text="Recent" class="section-label" />
        <Label
          col="1"
          :text="`${chatStore.history.length}`"
          class="section-count"
        />
      </GridLayout>

      <!--
        Navigation items — recent conversations (row 5, flex).

        Each row is 56dp tall:
          • 56×56dp icon slot — glyph centred (columns/rows="*" per §7);
          • active item: secondary-container fills the whole row as a pill;
          • label: nav-title (14/500 on-surface) + nav-meta (12 on-surface-variant 70%).
        Trailing: 40dp icon-button for deletion, 55 % opacity until pressed.
      -->
      <ListView
        v-if="chatStore.history.length"
        ref="listRef"
        row="5"
        class="history"
        :items="chatStore.history"
      >
        <template #default="{ item: conversation }">
          <GridLayout columns="*, auto" class="history-row-wrap">

            <!-- Tappable conversation row. -->
            <GridLayout
              col="0"
              columns="auto, *"
              class="nav-item"
              :class="{ 'nav-item--active': isActive(conversation) }"
              v-press
              @tap="onOpenConversation(conversation)"
            >
              <GridLayout col="0" columns="*" rows="*" class="nav-slot">
                <Icon
                  col="0" row="0"
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

            <!-- Trailing delete — 40dp icon button. -->
            <GridLayout
              col="1"
              columns="*"
              rows="*"
              class="nav-delete"
              v-press
              @tap="onDelete($event, conversation)"
            >
              <Icon col="0" row="0" name="trash" :size="18" tone="error" class="nav-glyph" />
            </GridLayout>

          </GridLayout>
        </template>
      </ListView>

      <!--
        Empty state (shown when there are no conversations).
        64×64dp tonal icon tile, headline (14/500), supporting body (12).
      -->
      <StackLayout v-else ref="listRef" row="5" class="history-empty">
        <ContentView class="empty-tile">
          <Icon name="edit" :size="24" tone="primary" />
        </ContentView>
        <Label text="No conversations yet." class="history-empty-title" />
        <Label
          text="Start one and it will show up here."
          class="history-empty-body"
          textWrap="true"
        />
      </StackLayout>

      <!--
        Footer — Profile · Settings · Model usage (row 6).
        Three standard nav-item rows in a StackLayout (vertical), topped by
        a 1dp outline-variant hairline divider.  No AbsoluteLayout — heights
        are natural so the footer grows with its content.
      -->
      <StackLayout ref="footerRef" row="6" class="footer">

        <ContentView class="footer-divider" />

        <!-- Profile -->
        <GridLayout
          columns="auto, *"
          class="nav-item nav-item--footer"
          v-press
          @tap="emit('openProfile')"
        >
          <GridLayout col="0" columns="*" rows="*" class="nav-slot">
            <Label :text="settings.initials" class="account-mark" />
          </GridLayout>
          <StackLayout col="1" class="nav-labels">
            <Label :text="settings.displayName" class="nav-title" textTrimming="end" />
            <Label text="Profile" class="nav-meta" />
          </StackLayout>
        </GridLayout>

        <!-- Settings -->
        <GridLayout
          columns="auto, *"
          class="nav-item nav-item--footer"
          v-press
          @tap="emit('openSettings')"
        >
          <GridLayout col="0" columns="*" rows="*" class="nav-slot">
            <Icon name="sliders" :size="24" tone="on-surface-variant" class="nav-glyph" />
          </GridLayout>
          <StackLayout col="1" class="nav-labels">
            <Label text="Settings" class="nav-title" />
            <Label text="Theme, accent, gateway" class="nav-meta" />
          </StackLayout>
        </GridLayout>

        <!-- Model usage -->
        <GridLayout
          columns="auto, *"
          class="nav-item nav-item--footer"
          v-press
          @tap="emit('openModelUsage')"
        >
          <GridLayout col="0" columns="*" rows="*" class="nav-slot">
            <Icon name="chart" :size="24" tone="on-surface-variant" class="nav-glyph" />
          </GridLayout>
          <StackLayout col="1" class="nav-labels">
            <Label text="Model usage" class="nav-title" />
            <Label text="Usage by route" class="nav-meta" />
          </StackLayout>
        </GridLayout>

      </StackLayout>
    </GridLayout>

    <!-- ── Scrim ───────────────────────────────────────────────────────── -->
    <GridLayout ref="scrimRef" col="1" class="scrim" @tap="close" />
  </GridLayout>
</template>

<style scoped>
/* ═══════════════════════════════════════════════════════════════════════
   Drawer shell
   ═══════════════════════════════════════════════════════════════════════ */

.drawer {
  horizontal-align: stretch;
  vertical-align: stretch;
}

/* ═══════════════════════════════════════════════════════════════════════
   Panel
   Material 3: surface-container-low · end corners 16dp · elevation-1.
   ═══════════════════════════════════════════════════════════════════════ */

.panel {
  background-color: var(--md-surface-container-low);
  horizontal-align: left;
  vertical-align: stretch;
  border-top-right-radius: 16;
  border-bottom-right-radius: 16;
  box-shadow: var(--md-elevation-1);
}

/* ═══════════════════════════════════════════════════════════════════════
   Header  (brand tile · wordmark · gateway chip)
   Top inset: 28dp (M3 modal drawer spec).
   ═══════════════════════════════════════════════════════════════════════ */

.header {
  padding: 28 24 12 28;
}

/* 44×44dp full circular brand tile with the new Omni Sphere. */
.brand-tile {
  width: 44;
  height: 44;
  border-radius: 22;
  background-color: transparent;
}

.brand-mark {
  width: 44;
  height: 44;
  border-radius: 22;
  horizontal-align: center;
  vertical-align: center;
}

.brand-content {
  padding-left: 12;
  vertical-align: center;
}

/* Title-large (22sp / 600). */
.brand-name {
  color: var(--md-on-surface);
  font-size: 22;
  font-weight: 600;
  letter-spacing: -0.01;
}

/* ── Gateway status chip ────────────────────────────────────────────── */

/* 24dp pill: secondary-container (live) / error-container (offline). */
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

/* Label-small (11 / 600). */
.status-text {
  color: var(--md-on-secondary-container);
  font-size: 11;
  font-weight: 600;
  vertical-align: center;
}

.status-chip--offline .status-text {
  color: var(--md-on-error-container);
}

/* ═══════════════════════════════════════════════════════════════════════
   Hairline dividers  (outline-variant, 60 % opacity)
   ═══════════════════════════════════════════════════════════════════════ */

.drawer-divider {
  padding: 0 20;
  height: 1;
}

.drawer-divider-line {
  height: 1;
  background-color: var(--md-outline-variant);
  horizontal-align: stretch;
  opacity: 0.6;
}

/* ═══════════════════════════════════════════════════════════════════════
   Action button — "New conversation"
   Material 3: Compact pill button, 44dp height, 22dp corner radius.
   Hugs content with auto-columns, clean 14dp/18dp padding, subtle elevation.
   ═══════════════════════════════════════════════════════════════════════ */

.fab {
  height: 44;
  border-radius: 22;
  margin: 10 16 10 16;
  padding: 0 18 0 14;
  background-color: var(--md-primary);
  box-shadow: var(--md-elevation-1);
  horizontal-align: left;
  vertical-align: center;
}

.fab:pressed {
  opacity: 0.85;
  transform: scale(0.96, 0.96);
}

.fab-icon {
  vertical-align: center;
  margin-right: 8;
}

.fab-label {
  color: var(--md-on-primary);
  font-size: 14;
  font-weight: 600;
  letter-spacing: 0.01;
  vertical-align: center;
}

/* ═══════════════════════════════════════════════════════════════════════
   Section subheader — "Recent"
   ═══════════════════════════════════════════════════════════════════════ */

.section {
  padding: 12 20 4 28;
}

/* Label-medium (12 / 600, tracked). */
.section-label {
  color: var(--md-on-surface-variant);
  font-size: 12;
  font-weight: 600;
  letter-spacing: 0.04;
  vertical-align: center;
}

/* 20dp count pill, secondary-container fill. */
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

/* ═══════════════════════════════════════════════════════════════════════
   Navigation items
   Height: 56dp.  Corner radius: 28dp (full pill).
   Side margin: 12dp — a 4dp gap to the panel edge.
   ═══════════════════════════════════════════════════════════════════════ */

.history {
  background-color: transparent;
}

/* Fills the list width so the row is measurable (§7). */
.history-row-wrap {
  width: 100%;
}

/* History list items. */
.nav-item {
  height: 56;
  border-radius: 28;
  margin: 2 12;
  padding: 0 12 0 4;
  horizontal-align: stretch;
}

/* Footer items share the structure but have no horizontal margin. */
.nav-item--footer {
  margin: 1 0;
  padding: 0 12 0 4;
}

/* State layer on press. */
.nav-item:pressed {
  background-color: var(--md-surface-container-highest);
}

/* Active indicator: secondary-container fills the full-pill row. */
.nav-item--active {
  background-color: var(--md-secondary-container);
}

/* Active label: on-secondary-container + semi-bold. */
.nav-item--active .nav-title {
  color: var(--md-on-secondary-container);
  font-weight: 600;
}

/* ── Icon slot ────────────────────────────────────────────────────────── */

/*
  56×56dp, columns/rows="*" (per §7 — `auto` misaligns the glyph).
  The active indicator pill is the background of the whole nav-item.
*/
.nav-slot {
  width: 56;
  height: 56;
  vertical-align: center;
}

.nav-glyph {
  horizontal-align: center;
  vertical-align: center;
}

/* ── Label area ─────────────────────────────────────────────────────── */

.nav-labels {
  vertical-align: center;
  padding: 0 8 0 4;
}

/* Label-large (14sp / 500). */
.nav-title {
  color: var(--md-on-surface);
  font-size: 14;
  font-weight: 500;
}

/* Label-medium (12sp / 400, 70 % opacity). */
.nav-meta {
  color: var(--md-on-surface-variant);
  font-size: 12;
  opacity: 0.7;
  margin-top: 1;
}

/* ── Trailing delete icon-button (40dp) ──────────────────────────────── */

.nav-delete {
  width: 40;
  height: 40;
  border-radius: 20;
  vertical-align: center;
  margin-right: 4;
  opacity: 0.55;
}

.nav-delete:pressed {
  background-color: var(--md-error-container);
  opacity: 1;
}

/* ── Account avatar — initials pill ─────────────────────────────────── */

/* 36×36dp pill, primary-container fill, on-primary-container ink. */
.account-mark {
  font-size: 13;
  font-weight: 700;
  width: 36;
  height: 36;
  border-radius: 18;
  background-color: var(--md-primary-container);
  color: var(--md-on-primary-container);
  text-align: center;
  vertical-align: center;
  horizontal-align: center;
}

/* ═══════════════════════════════════════════════════════════════════════
   Empty state
   ═══════════════════════════════════════════════════════════════════════ */

.history-empty {
  padding: 32 24;
  horizontal-align: center;
}

/* 64×64dp tonal icon tile, shape-L (16dp). */
.empty-tile {
  width: 64;
  height: 64;
  border-radius: 16;
  background-color: var(--md-surface-container-high);
  margin-bottom: 16;
  horizontal-align: center;
}

/* Body-medium (14 / 500). */
.history-empty-title {
  color: var(--md-on-surface);
  font-size: 14;
  font-weight: 500;
  text-align: center;
}

/* Body-small (12 / 400). */
.history-empty-body {
  color: var(--md-on-surface-variant);
  font-size: 12;
  text-align: center;
  margin-top: 6;
  opacity: 0.8;
}

/* ═══════════════════════════════════════════════════════════════════════
   Footer  (Profile · Settings · Model usage)
   ═══════════════════════════════════════════════════════════════════════ */

.footer {
  padding: 0 4 10 16;
}

/* 1dp hairline between list and footer. */
.footer-divider {
  height: 1;
  background-color: var(--md-outline-variant);
  horizontal-align: stretch;
  opacity: 0.6;
  margin-bottom: 4;
}

/* ═══════════════════════════════════════════════════════════════════════
   Scrim
   ═══════════════════════════════════════════════════════════════════════ */

.scrim {
  background-color: var(--md-scrim);
  horizontal-align: stretch;
  vertical-align: stretch;
}
</style>
