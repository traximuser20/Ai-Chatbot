<script lang="ts" setup>
/**
 * Settings screen.
 *
 * Everything on this screen is real: the text size changes the interface,
 * the switches change how the chat behaves, and the data section actually
 * clears the stored conversations.
 *
 * The layout follows the Material 3 recipe: a top app bar, cards that group
 * the rows of a section, segmented buttons for the choices that fit into one
 * line, and switches for the ones that are on or off.
 */
import { ref, onMounted, nextTick } from 'vue';
import { $navigateBack } from 'nativescript-vue';
import { useChatStore } from '../stores/chat';
import { useSettingsStore, type TextScale } from '../stores/settings';
import { useThemeStore } from '../stores/theme';
import { omniAi, gatewayUrl, setGatewayAddress, defaultGatewayHost, GATEWAY_PORT } from '../services/omni-ai';
import { enter, pulse } from '../utils/motion';
import Icon from './Icon.vue';
import MdSwitch from './MdSwitch.vue';

const chatStore = useChatStore();
const settings = useSettingsStore();
const theme = useThemeStore();

const reconnecting = ref(false);
const reconnectMessage = ref('');

/* ------------------------------------------------------------------ */
/* The address of the gateway                                          */
/* ------------------------------------------------------------------ */

/** The address the app uses right now. */
const gatewayAddress = ref(gatewayUrl());
/** What the user is typing. */
const addressDraft = ref('');
/** True for a moment after the address was stored. */
const addressSaved = ref(false);

/** The address the platform picks when nothing was chosen by hand. */
const defaultAddress = `http://${defaultGatewayHost()}:${GATEWAY_PORT}`;

const scales: { value: TextScale; label: string }[] = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
];

/* ------------------------------------------------------------------ */
/* Segmented control                                                   */
/* ------------------------------------------------------------------ */

/** The segmented control, so the picked option can be popped. */
const segmentRef = ref<any>(null);
/** The segmented control of the theme. */
const themeSegmentRef = ref<any>(null);
/** The body of the screen, so it can rise into place. */
const bodyRef = ref<any>(null);

/**
 * Pops the option that was just picked, so the change is felt and not only
 * seen.
 */
function popSegment(scale: TextScale) {
  const index = scales.findIndex((item) => item.value === scale);
  const view = segmentRef.value?.nativeView?.children?.[index]?.nativeView;
  if (view) {
    pulse(view, 1.08);
  }
}

/** The same for the theme. */
function popThemeSegment(index: number) {
  const view = themeSegmentRef.value?.nativeView?.children?.[index]?.nativeView;
  if (view) {
    pulse(view, 1.08);
  }
}

onMounted(() => {
  addressDraft.value = gatewayUrl();
  nextTick(() => {
    enter(bodyRef.value?.nativeView, { distance: 16, duration: 420 });
  });
});

function back() {
  $navigateBack();
}

function onShowTimestamps(value: boolean) {
  settings.setShowTimestamps(value);
}

function onSendOnEnter(value: boolean) {
  settings.setSendOnEnter(value);
}

/** Re-probes the gateway so the connection state is accurate again. */
async function reconnect() {
  reconnecting.value = true;
  reconnectMessage.value = '';
  gatewayAddress.value = gatewayUrl();
  try {
    const models = await omniAi.loadModels(true);
    reconnectMessage.value = `Connected · ${models.length} routes`;
  } catch (err) {
    reconnectMessage.value = err instanceof Error ? err.message : 'Could not reach the gateway.';
  } finally {
    reconnecting.value = false;
  }
}

/**
 * Stores the address of the gateway and probes it again.
 *
 * An empty field restores the address of the platform - the emulator alias
 * for the host, or the loopback of the phone with the forwarded port.
 */
async function saveAddress() {
  setGatewayAddress(addressDraft.value);
  gatewayAddress.value = gatewayUrl();
  addressSaved.value = true;
  setTimeout(() => {
    addressSaved.value = false;
  }, 1600);
  await reconnect();
}

function clearHistory() {
  chatStore.clearHistory();
}
</script>

<template>
  <Page actionBarHidden="true" class="screen">
    <GridLayout rows="auto, *">
      <!-- ── Top app bar ────────────────────────────────────────────────── -->
      <GridLayout row="0" columns="auto, *" class="app-bar">
        <GridLayout col="0" columns="auto" class="back-button" v-press @tap="back">
          <Icon col="0" name="chevron-left" :size="22" tone="on-surface-variant" />
        </GridLayout>
        <Label col="1" text="Settings" class="app-bar-title" />
      </GridLayout>

      <ScrollView row="1" class="screen-scroll">
        <StackLayout ref="bodyRef" class="body">
          <!-- ── Appearance ───────────────────────────────────────────────── -->
          <Label text="Appearance" class="group-label" />

          <GridLayout columns="*" rows="auto, auto" class="md-card card">
            <StackLayout row="0">
              <Label text="Theme" class="md-title" />
              <Label text="Follows the device unless you pick a theme" class="md-support" />
            </StackLayout>
            <!--
              The segmented control. The options are written out one by one:
              the children of a `v-for` inside a GridLayout are all placed in
              column 0 and drawn on top of each other.
            -->
            <GridLayout ref="themeSegmentRef" row="1" columns="*, *, *" class="segment">
              <GridLayout
                col="0"
                columns="auto, auto"
                class="segment-item segment-item--first"
                :class="{ 'segment-item--active': theme.mode === 'system' }"
                v-press
                @tap="theme.setMode('system'); popThemeSegment(0)"
              >
                <Icon
                  v-if="theme.mode === 'system'"
                  col="0"
                  name="check"
                  :size="14"
                  tone="on-secondary-container"
                  class="segment-check"
                />
                <Label col="1" text="System" class="segment-label" />
              </GridLayout>
              <GridLayout
                col="1"
                columns="auto, auto"
                class="segment-item"
                :class="{ 'segment-item--active': theme.mode === 'light' }"
                v-press
                @tap="theme.setMode('light'); popThemeSegment(1)"
              >
                <Icon
                  v-if="theme.mode === 'light'"
                  col="0"
                  name="check"
                  :size="14"
                  tone="on-secondary-container"
                  class="segment-check"
                />
                <Label col="1" text="Light" class="segment-label" />
              </GridLayout>
              <GridLayout
                col="2"
                columns="auto, auto"
                class="segment-item segment-item--last"
                :class="{ 'segment-item--active': theme.mode === 'dark' }"
                v-press
                @tap="theme.setMode('dark'); popThemeSegment(2)"
              >
                <Icon
                  v-if="theme.mode === 'dark'"
                  col="0"
                  name="check"
                  :size="14"
                  tone="on-secondary-container"
                  class="segment-check"
                />
                <Label col="1" text="Dark" class="segment-label" />
              </GridLayout>
            </GridLayout>
          </GridLayout>

          <GridLayout ref="cardRef" columns="*" rows="auto, auto" class="md-card card">
            <StackLayout row="0">
              <Label text="Text size" class="md-title" />
              <Label text="Scales the conversation and the interface" class="md-support" />
            </StackLayout>
            <!--
              The segmented control. The three options are written out one by
              one: the children of a `v-for` inside a GridLayout are all
              placed in column 0 and drawn on top of each other.
            -->
            <GridLayout ref="segmentRef" row="1" columns="*, *, *" class="segment">
              <GridLayout
                col="0"
                columns="auto, auto"
                class="segment-item segment-item--first"
                :class="{ 'segment-item--active': settings.textScale === 'small' }"
                v-press
                @tap="settings.setTextScale('small'); popSegment('small')"
              >
                <Icon
                  v-if="settings.textScale === 'small'"
                  col="0"
                  name="check"
                  :size="14"
                  tone="on-secondary-container"
                  class="segment-check"
                />
                <Label col="1" text="Small" class="segment-label" />
              </GridLayout>
              <GridLayout
                col="1"
                columns="auto, auto"
                class="segment-item"
                :class="{ 'segment-item--active': settings.textScale === 'medium' }"
                v-press
                @tap="settings.setTextScale('medium'); popSegment('medium')"
              >
                <Icon
                  v-if="settings.textScale === 'medium'"
                  col="0"
                  name="check"
                  :size="14"
                  tone="on-secondary-container"
                  class="segment-check"
                />
                <Label col="1" text="Medium" class="segment-label" />
              </GridLayout>
              <GridLayout
                col="2"
                columns="auto, auto"
                class="segment-item segment-item--last"
                :class="{ 'segment-item--active': settings.textScale === 'large' }"
                v-press
                @tap="settings.setTextScale('large'); popSegment('large')"
              >
                <Icon
                  v-if="settings.textScale === 'large'"
                  col="0"
                  name="check"
                  :size="14"
                  tone="on-secondary-container"
                  class="segment-check"
                />
                <Label col="1" text="Large" class="segment-label" />
              </GridLayout>
            </GridLayout>
          </GridLayout>

          <!-- ── Conversation ─────────────────────────────────────────────── -->
          <Label text="Conversation" class="group-label" />

          <GridLayout columns="*, auto" class="md-card card row">
            <StackLayout col="0">
              <Label text="Show timestamps" class="md-title" />
              <Label text="Print the time under each reply" class="md-support" />
            </StackLayout>
            <MdSwitch
              col="1"
              :checked="settings.showTimestamps"
              @change="onShowTimestamps"
            />
          </GridLayout>

          <GridLayout columns="*, auto" class="md-card card row">
            <StackLayout col="0">
              <Label text="Send with Enter" class="md-title" />
              <Label text="Submit the composer from the keyboard" class="md-support" />
            </StackLayout>
            <MdSwitch col="1" :checked="settings.sendOnEnter" @change="onSendOnEnter" />
          </GridLayout>

          <!-- ── Gateway ──────────────────────────────────────────────────── -->
          <Label text="Gateway" class="group-label" />

          <GridLayout rows="auto, auto, auto" columns="auto, *" class="md-card card row">
            <Icon
              col="0"
              row="0"
              name="dot"
              :size="10"
              :tone="chatStore.isConnected ? 'live' : 'offline'"
              class="status-dot"
            />
            <Label col="1" row="0" text="Omni Ai" class="md-title" />
            <Label col="1" row="1" :text="gatewayAddress" class="row-mono" />
            <Label
              col="1"
              row="2"
              :text="reconnectMessage || (chatStore.isConnected ? 'Connected' : 'Not reachable')"
              class="md-support"
            />
          </GridLayout>

          <!--
            The address can be pointed at another host - the LAN address of
            the machine that runs the gateway, for instance. An empty field
            restores the address of the platform.
          -->
          <Label text="Address" class="field-label" />
          <GridLayout columns="*, auto" class="field-row">
            <TextField
              col="0"
              v-model="addressDraft"
              class="field"
              hint="http://host:20128"
              returnKeyType="done"
              @submit="saveAddress"
            />
            <Label
              col="1"
              :text="addressSaved ? 'Saved' : 'Save'"
              class="field-action"
              :class="{ 'field-action--saved': addressSaved }"
              v-press
              @tap="saveAddress"
            />
          </GridLayout>
          <Label :text="`Default: ${defaultAddress}`" class="md-support field-hint" />

          <GridLayout columns="*, auto" class="md-card card row" v-press @tap="reconnect">
            <Label col="0" text="Reconnect" class="md-title" />
            <Label
              col="1"
              :text="reconnecting ? '…' : 'Retry'"
              class="row-action"
            />
          </GridLayout>

          <!-- ── Data ─────────────────────────────────────────────────────── -->
          <Label text="Data" class="group-label" />

          <GridLayout columns="*, auto" class="md-card card row" v-press @tap="clearHistory">
            <StackLayout col="0">
              <Label text="Clear chat history" class="md-title" />
              <Label text="Removes every stored conversation" class="md-support" />
            </StackLayout>
            <Label col="1" text="Clear" class="row-action row-action--danger" />
          </GridLayout>

          <!-- ── About ────────────────────────────────────────────────────── -->
          <Label text="About" class="group-label" />

          <GridLayout columns="*, auto" class="md-card card row">
            <StackLayout col="0">
              <Label text="Omni Ai client" class="md-title" />
              <Label text="NativeScript · Vue 3 · Pinia · Material 3" class="md-support" />
            </StackLayout>
            <Label col="1" text="v1.0.0" class="row-mono" />
          </GridLayout>
        </StackLayout>
      </ScrollView>
    </GridLayout>
  </Page>
</template>

<style scoped>
.screen {
  background-color: var(--md-surface);
}

/* ---------- Top app bar ---------- */
.app-bar {
  background-color: var(--md-surface);
  border-bottom-width: 1;
  border-bottom-color: var(--md-outline-variant);
  padding: 8 12;
}

.back-button {
  width: 44;
  height: 44;
  vertical-align: center;
}

.app-bar-title {
  color: var(--md-on-surface);
  font-size: 22;
  font-weight: 600;
  vertical-align: center;
}

.screen-scroll {
  background-color: var(--md-surface);
}

.body {
  padding: 8 16 32 16;
}

/* ---------- Groups ---------- */
.group-label {
  color: var(--md-primary);
  font-size: 12;
  font-weight: 600;
  letter-spacing: 0.08;
  text-transform: uppercase;
  margin-bottom: 8;
  margin-top: 18;
}

/* ---------- Rows ---------- */
.card {
  margin-bottom: 8;
}

.row {
  padding: 14 16;
}

.row-mono {
  color: var(--md-on-surface-variant);
  font-size: 12;
  margin-top: 4;
}

.row-action {
  color: var(--md-primary);
  font-size: 14;
  font-weight: 600;
  vertical-align: center;
  padding-left: 12;
}

.row-action--danger {
  color: var(--md-error);
}

.status-dot {
  margin-right: 8;
  vertical-align: center;
}

/* ---------- The address field ---------- */
.field-label {
  color: var(--md-on-surface-variant);
  font-size: 12;
  font-weight: 500;
  letter-spacing: 0.06;
  text-transform: uppercase;
  margin-bottom: 8;
  margin-top: 4;
}

.field-row {
  margin-bottom: 6;
}

/* An outlined text field. */
.field {
  background-color: transparent;
  border-width: 1;
  border-color: var(--md-outline);
  border-radius: 12;
  color: var(--md-on-surface);
  placeholder-color: var(--md-on-surface-variant);
  font-size: 15;
  padding: 14;
  /* The field fills the row, the action sits next to it. */
  width: 100%;
}

.field-action {
  color: var(--md-primary);
  font-size: 14;
  font-weight: 600;
  vertical-align: center;
  margin-left: 12;
  text-align: right;
}

.field-action--saved {
  color: var(--md-live);
}

.field-hint {
  margin-bottom: 8;
}

/* ---------- Segmented button ---------- */
.segment {
  margin-top: 14;
}

.segment-item {
  height: 40;
  border-width: 1;
  border-color: var(--md-outline);
  border-left-width: 0;
  padding: 0 8;
  vertical-align: center;
}

.segment-item--first {
  border-left-width: 1;
  border-top-left-radius: 20;
  border-bottom-left-radius: 20;
}

.segment-item--last {
  border-top-right-radius: 20;
  border-bottom-right-radius: 20;
}

.segment-item--active {
  background-color: var(--md-secondary-container);
}

.segment-check {
  margin-right: 6;
  vertical-align: center;
}

.segment-label {
  color: var(--md-on-surface);
  font-size: 14;
  font-weight: 500;
  vertical-align: center;
}

.segment-item--active .segment-label {
  color: var(--md-on-secondary-container);
  font-weight: 600;
}
</style>
