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
import { ref, computed, onMounted, nextTick } from 'vue';
import { $navigateBack } from 'nativescript-vue';
import { useChatStore } from '../stores/chat';
import { useSettingsStore, type TextScale } from '../stores/settings';
import { useThemeStore } from '../stores/theme';
import { omniAi, gatewayUrl, setGatewayAddress, defaultGatewayHost, GATEWAY_PORT } from '../services/omni-ai';
import { ensureNotifications } from '../services/permissions';
import { ensureChannel } from '../services/notifications';
import {
  ACCENT_AUTO,
  accentFor,
  gradientAccentOf,
  gradientCss,
  type AccentId,
} from '../utils/accent';
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

/* ------------------------------------------------------------------ */
/* The accent                                                          */
/* ------------------------------------------------------------------ */

/** The accent that is pinned right now. */
const chosenAccent = computed(() => settings.accent);

/** The pill of the picker tells which accent is on screen. */
const accentDescription = computed(() =>
  chosenAccent.value === ACCENT_AUTO
    ? 'The interface is painted by the provider that answers'
    : 'Pinned across the whole app, on every screen',
);

/** The gradient of a swatch - null when it follows the route. */
function swatchGradient(id: string): string | null {
  const accent = gradientAccentOf(id);
  return accent ? gradientCss(accent) : null;
}

/**
 * The paint of the Default swatch: the accent of the provider that answers
 * the current route. It is read from the route and not from the interface,
 * so the swatch keeps its own colour when another accent is pinned.
 */
const routeSwatchColor = computed(() => accentFor(chatStore.model));

/**
 * Pins an accent and pulses the swatch that was tapped. Repainting the app
 * is not this screen's business: the palette store recomputes the scheme and
 * `App.vue` writes it into the root view, so the whole interface follows at
 * once - this screen included.
 */
function chooseAccent(id: AccentId, event: any) {
  settings.setAccent(id);
  pulse(event?.object, 1.08);
}

onMounted(() => {
  addressDraft.value = gatewayUrl();
  sttDraft.value = settings.sttModel;
  ttsDraft.value = settings.ttsModel;
  voiceDraft.value = settings.ttsVoice;
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

/* ------------------------------------------------------------------ */
/* Voice and notifications                                              */
/* ------------------------------------------------------------------ */

/** What the user is typing in the model fields. */
const sttDraft = ref('');
const ttsDraft = ref('');
const voiceDraft = ref('');

/**
 * Turns the reading of replies on or off.
 *
 * Switching it on asks for the notification permission as well: the two
 * features are announced in the same place in the app, and the reader is
 * silent when the reply lands in the background.
 */
async function onSpeakReplies(value: boolean) {
  settings.setSpeakReplies(value);
  if (value) {
    await ensureNotifications();
  }
}

/** Turns the notification for a reply that lands in the background on or off. */
async function onNotifications(value: boolean) {
  settings.setNotifications(value);
  if (value) {
    const granted = await ensureNotifications();
    if (granted) {
      ensureChannel();
    }
  }
}

/** Stores the speech-to-text model. */
function saveSttModel() {
  settings.setSttModel(sttDraft.value);
  sttDraft.value = settings.sttModel;
}

/** Stores the text-to-speech model. */
function saveTtsModel() {
  settings.setTtsModel(ttsDraft.value);
  ttsDraft.value = settings.ttsModel;
}

/** Stores the voice of the speech model. */
function saveTtsVoice() {
  settings.setTtsVoice(voiceDraft.value);
  voiceDraft.value = settings.ttsVoice;
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
      <GridLayout row="0" columns="auto, *" class="md-top-bar">
        <!-- `columns="*"` centres the glyph - an `auto` track would hug it. -->
        <GridLayout col="0" columns="*" rows="*" class="md-icon-button" v-press @tap="back">
          <Icon col="0" name="chevron-left" :size="22" tone="on-surface-variant" />
        </GridLayout>
        <Label col="1" text="Settings" class="md-top-bar-title" />
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
                  tone="on-primary"
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
                  tone="on-primary"
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
                  tone="on-primary"
                  class="segment-check"
                />
                <Label col="1" text="Dark" class="segment-label" />
              </GridLayout>
            </GridLayout>
          </GridLayout>

          <!--
            The accent: one of five gradients pinned across the whole app, or
            the route itself, which keeps painting the interface in the colour
            of its provider. A pinned accent is the seed of the Material 3
            scheme - the palette store rebuilds it and `App.vue` writes it
            into the root view, so every screen follows at once.
          -->
          <GridLayout columns="*" rows="auto, auto" class="md-card card">
            <StackLayout row="0">
              <Label text="Accent" class="md-title" />
              <Label :text="accentDescription" class="md-support" />
            </StackLayout>
            <!--
              The swatches are written out one by one: the children of a
              `v-for` inside a GridLayout would all land in column 0.
            -->
            <GridLayout row="1" columns="*, *, *" rows="auto, auto" class="accent-pick">
              <StackLayout
                row="0"
                col="0"
                class="accent-cell"
                v-press
                @tap="chooseAccent(ACCENT_AUTO, $event)"
              >
                <GridLayout
                  columns="*"
                  class="accent-swatch accent-swatch--route"
                  :backgroundColor="routeSwatchColor"
                >
                  <Icon
                    v-if="chosenAccent === ACCENT_AUTO"
                    col="0"
                    name="check"
                    :size="18"
                    color="#FFFFFF"
                  />
                </GridLayout>
                <Label
                  text="Default"
                  class="accent-cell-label"
                  :class="{ 'accent-cell-label--chosen': chosenAccent === ACCENT_AUTO }"
                />
              </StackLayout>

              <StackLayout
                row="0"
                col="1"
                class="accent-cell"
                v-press
                @tap="chooseAccent('azure', $event)"
              >
                <GridLayout
                  columns="*"
                  class="accent-swatch"
                  :style="{ backgroundImage: swatchGradient('azure') }"
                >
                  <Icon
                    v-if="chosenAccent === 'azure'"
                    col="0"
                    name="check"
                    :size="18"
                    color="#FFFFFF"
                  />
                </GridLayout>
                <Label
                  text="Azure"
                  class="accent-cell-label"
                  :class="{ 'accent-cell-label--chosen': chosenAccent === 'azure' }"
                />
              </StackLayout>

              <StackLayout
                row="0"
                col="2"
                class="accent-cell"
                v-press
                @tap="chooseAccent('aurora', $event)"
              >
                <GridLayout
                  columns="*"
                  class="accent-swatch"
                  :style="{ backgroundImage: swatchGradient('aurora') }"
                >
                  <Icon
                    v-if="chosenAccent === 'aurora'"
                    col="0"
                    name="check"
                    :size="18"
                    color="#FFFFFF"
                  />
                </GridLayout>
                <Label
                  text="Aurora"
                  class="accent-cell-label"
                  :class="{ 'accent-cell-label--chosen': chosenAccent === 'aurora' }"
                />
              </StackLayout>

              <StackLayout
                row="1"
                col="0"
                class="accent-cell"
                v-press
                @tap="chooseAccent('sunset', $event)"
              >
                <GridLayout
                  columns="*"
                  class="accent-swatch"
                  :style="{ backgroundImage: swatchGradient('sunset') }"
                >
                  <Icon
                    v-if="chosenAccent === 'sunset'"
                    col="0"
                    name="check"
                    :size="18"
                    color="#FFFFFF"
                  />
                </GridLayout>
                <Label
                  text="Sunset"
                  class="accent-cell-label"
                  :class="{ 'accent-cell-label--chosen': chosenAccent === 'sunset' }"
                />
              </StackLayout>

              <StackLayout
                row="1"
                col="1"
                class="accent-cell"
                v-press
                @tap="chooseAccent('orchid', $event)"
              >
                <GridLayout
                  columns="*"
                  class="accent-swatch"
                  :style="{ backgroundImage: swatchGradient('orchid') }"
                >
                  <Icon
                    v-if="chosenAccent === 'orchid'"
                    col="0"
                    name="check"
                    :size="18"
                    color="#FFFFFF"
                  />
                </GridLayout>
                <Label
                  text="Orchid"
                  class="accent-cell-label"
                  :class="{ 'accent-cell-label--chosen': chosenAccent === 'orchid' }"
                />
              </StackLayout>

              <StackLayout
                row="1"
                col="2"
                class="accent-cell"
                v-press
                @tap="chooseAccent('rose', $event)"
              >
                <GridLayout
                  columns="*"
                  class="accent-swatch"
                  :style="{ backgroundImage: swatchGradient('rose') }"
                >
                  <Icon
                    v-if="chosenAccent === 'rose'"
                    col="0"
                    name="check"
                    :size="18"
                    color="#FFFFFF"
                  />
                </GridLayout>
                <Label
                  text="Rose"
                  class="accent-cell-label"
                  :class="{ 'accent-cell-label--chosen': chosenAccent === 'rose' }"
                />
              </StackLayout>
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
                  tone="on-primary"
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
                  tone="on-primary"
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
                  tone="on-primary"
                  class="segment-check"
                />
                <Label col="1" text="Large" class="segment-label" />
              </GridLayout>
            </GridLayout>
          </GridLayout>

          <!-- ── Conversation ─────────────────────────────────────────────── -->
          <Label text="Conversation" class="group-label" />

          <GridLayout columns="*, auto" class="md-card card md-list-row">
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

          <GridLayout columns="*, auto" class="md-card card md-list-row">
            <StackLayout col="0">
              <Label text="Send with Enter" class="md-title" />
              <Label text="Submit the composer from the keyboard" class="md-support" />
            </StackLayout>
            <MdSwitch col="1" :checked="settings.sendOnEnter" @change="onSendOnEnter" />
          </GridLayout>

          <!-- ── Voice & notifications ────────────────────────────────────── -->
          <Label text="Voice & notifications" class="group-label" />

          <GridLayout columns="*, auto" class="md-card card md-list-row">
            <StackLayout col="0">
              <Label text="Speak replies" class="md-title" />
              <Label
                text="Reads every answer out loud · voice chat always speaks"
                class="md-support"
                textWrap="true"
              />
            </StackLayout>
            <MdSwitch col="1" :checked="settings.speakReplies" @change="onSpeakReplies" />
          </GridLayout>

          <GridLayout columns="*, auto" class="md-card card md-list-row">
            <StackLayout col="0">
              <Label text="Reply notifications" class="md-title" />
              <Label
                text="Tell me when a reply lands while the app is in the background"
                class="md-support"
                textWrap="true"
              />
            </StackLayout>
            <MdSwitch col="1" :checked="settings.notifications" @change="onNotifications" />
          </GridLayout>

          <!--
            The two models and the voice of the gateway's audio routes. An
            empty field restores the default of the gateway.
          -->
          <Label text="Speech to text" class="field-label" />
          <GridLayout columns="*" class="field-row">
            <TextField
              col="0"
              v-model="sttDraft"
              class="field"
              hint="whisper-1"
              returnKeyType="done"
              @submit="saveSttModel"
              @blur="saveSttModel"
            />
          </GridLayout>
          <Label
            text="The model that turns your voice into text · used by voice search and voice chat"
            class="md-support field-hint"
            textWrap="true"
          />

          <Label text="Text to speech" class="field-label" />
          <GridLayout columns="*" class="field-row">
            <TextField
              col="0"
              v-model="ttsDraft"
              class="field"
              hint="tts-1"
              returnKeyType="done"
              @submit="saveTtsModel"
              @blur="saveTtsModel"
            />
          </GridLayout>
          <Label text="Voice" class="field-label" />
          <GridLayout columns="*" class="field-row">
            <TextField
              col="0"
              v-model="voiceDraft"
              class="field"
              hint="alloy"
              returnKeyType="done"
              @submit="saveTtsVoice"
              @blur="saveTtsVoice"
            />
          </GridLayout>
          <Label
            text="The model and the voice that read replies out loud"
            class="md-support field-hint"
            textWrap="true"
          />

          <!-- ── Gateway ──────────────────────────────────────────────────── -->
          <Label text="Gateway" class="group-label" />

          <GridLayout rows="auto, auto, auto" columns="auto, *" class="md-card card md-list-row">
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

          <GridLayout columns="auto, *, auto" class="md-card card md-list-row" v-press @tap="reconnect">
            <Icon col="0" name="retry" :size="20" tone="on-surface-variant" class="row-icon" />
            <Label col="1" text="Reconnect" class="md-title" />
            <Label
              col="2"
              :text="reconnecting ? '…' : 'Retry'"
              class="row-action"
            />
          </GridLayout>

          <!-- ── Data ─────────────────────────────────────────────────────── -->
          <Label text="Data" class="group-label" />

          <GridLayout columns="auto, *, auto" class="md-card card md-list-row" v-press @tap="clearHistory">
            <Icon col="0" name="trash" :size="20" tone="on-surface-variant" class="row-icon" />
            <StackLayout col="1">
              <Label text="Clear chat history" class="md-title" />
              <Label text="Removes every stored conversation" class="md-support" />
            </StackLayout>
            <Label col="2" text="Clear" class="row-action row-action--danger" />
          </GridLayout>

          <!-- ── About ────────────────────────────────────────────────────── -->
          <Label text="About" class="group-label" />

          <GridLayout columns="auto, *, auto" class="md-card card md-list-row">
            <Icon col="0" name="info" :size="20" tone="on-surface-variant" class="row-icon" />
            <StackLayout col="1">
              <Label text="Omni Ai client" class="md-title" />
              <Label text="NativeScript · Vue 3 · Pinia · Material 3" class="md-support" />
            </StackLayout>
            <Label col="2" text="v1.0.0" class="row-mono" />
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
  letter-spacing: 0.1;
  text-transform: uppercase;
  margin-bottom: 8;
  margin-top: 20;
}

/* ---------- Rows ---------- */
.card {
  margin-bottom: 8;
}

/* The slot of the icon is kept with margins - see `AttachSheet.vue`. */
.row-icon {
  margin-left: 5;
  margin-right: 17;
  vertical-align: center;
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
  margin-right: 10;
  vertical-align: center;
}

/* ---------- The address field ---------- */
.field-label {
  color: var(--md-on-surface-variant);
  font-size: 12;
  font-weight: 600;
  letter-spacing: 0.08;
  text-transform: uppercase;
  margin-bottom: 8;
  margin-top: 6;
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
  background-color: var(--md-primary);
  border-color: var(--md-primary);
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
  color: var(--md-on-primary);
  font-weight: 600;
}

/* ---------- The accent swatches ---------- */
.accent-pick {
  margin-top: 14;
}

/* A cell holds a circle and its name, and the whole cell is tappable. */
.accent-cell {
  padding: 10 4 6 4;
}

/* The circle of the swatch, riding in the middle of its cell. */
.accent-swatch {
  width: 44;
  height: 44;
  border-radius: 22;
  horizontal-align: center;
}

/*
  Route: no gradient of its own. The circle is painted with a property
  (`routeSwatchColor` - the accent of the provider that answers), because a
  rule would follow the pinned accent and the swatch has to keep showing the
  route's own colour.
*/
.accent-swatch--route {
  background-color: var(--md-surface-variant);
}

.accent-cell-label {
  color: var(--md-on-surface-variant);
  font-size: 12;
  margin-top: 7;
  text-align: center;
}

.accent-cell-label--chosen {
  color: var(--md-primary);
  font-weight: 600;
}

</style>
