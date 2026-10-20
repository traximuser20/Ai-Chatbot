<script lang="ts" setup>
/**
 * Settings screen.
 *
 * Everything on this screen is real: the text size changes the interface,
 * the switches change how the chat behaves, and the data section actually
 * clears the stored conversations.
 */
import { ref, watch, onMounted, nextTick } from 'vue';
import { $navigateBack } from 'nativescript-vue';
import { useChatStore } from '../stores/chat';
import { useSettingsStore, type TextScale } from '../stores/settings';
import { omniAi, BASE_URL } from '../services/omni-ai';
import Icon from './Icon.vue';

const chatStore = useChatStore();
const settings = useSettingsStore();

const reconnecting = ref(false);
const reconnectMessage = ref('');

const scales: { value: TextScale; label: string }[] = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
];

/* ------------------------------------------------------------------ */
/* Segmented control                                                   */
/* ------------------------------------------------------------------ */

/** The segmented control and the sliding pill. */
const segmentRef = ref<any>(null);
const pillRef = ref<any>(null);
/** Width of one segment, used to lay the labels out evenly. */
const itemWidth = ref(0);

/**
 * Measures the segmented control and moves the white pill onto the active
 * option. The pill is moved with a translation, because a layout property
 * such as `left` cannot be animated.
 */
function layoutSegment(animated: boolean) {
  const segment = segmentRef.value?.nativeView;
  const pill = pillRef.value?.nativeView;
  if (!segment || !pill) {
    return;
  }

  const padding = 3;
  const width = Math.max(0, segment.getMeasuredWidth() - padding * 2);
  const item = width / scales.length;
  itemWidth.value = item;

  pill.width = Math.max(0, item - 2);
  pill.left = 1;

  const index = Math.max(
    0,
    scales.findIndex((scale) => scale.value === settings.textScale),
  );
  const target = index * item;

  if (animated) {
    pill.animate({ translate: { x: target, y: 0 }, duration: 260, curve: 'easeOut' });
  } else {
    pill.translateX = target;
  }
}

onMounted(() => {
  nextTick(() => layoutSegment(false));
});

watch(
  () => settings.textScale,
  () => layoutSegment(true),
);

function back() {
  $navigateBack();
}

function onShowTimestamps(event: any) {
  settings.setShowTimestamps(!!event?.value);
}

function onSendOnEnter(event: any) {
  settings.setSendOnEnter(!!event?.value);
}

/** Re-probes the gateway so the connection state is accurate again. */
async function reconnect() {
  reconnecting.value = true;
  reconnectMessage.value = '';
  try {
    const models = await omniAi.loadModels(true);
    reconnectMessage.value = `Connected · ${models.length} routes`;
  } catch (err) {
    reconnectMessage.value = err instanceof Error ? err.message : 'Could not reach the gateway.';
  } finally {
    reconnecting.value = false;
  }
}

function clearHistory() {
  chatStore.clearHistory();
}
</script>

<template>
  <Page actionBarHidden="true" class="screen">
    <GridLayout rows="auto, *">
      <!-- ── Header ─────────────────────────────────────────────────────── -->
      <GridLayout row="0" columns="auto, *" class="screen-header">
        <GridLayout col="0" columns="auto" class="back-button" v-press @tap="back">
          <Icon col="0" name="chevron-left" :size="19" color="#1B1E24" />
        </GridLayout>
        <Label col="1" text="Settings" class="screen-title" />
      </GridLayout>

      <ScrollView row="1" class="screen-scroll">
        <StackLayout class="body">
          <!-- ── Appearance ───────────────────────────────────────────────── -->
          <Label text="Appearance" class="group-label" />

          <GridLayout rows="auto, auto" class="card">
            <StackLayout row="0">
              <Label text="Text size" class="row-title" />
              <Label text="Scales the conversation and the interface" class="row-sub" />
            </StackLayout>
            <!--
              The segmented control is an AbsoluteLayout: a white pill slides
              between the options while the labels sit on top of it.

              The labels live in a horizontal StackLayout - in NativeScript-Vue
              the children of a 'v-for' inside a GridLayout are all placed in
              column 0 and drawn on top of each other (the segmented control
              rendered "Medium" and "Large" overlapping).
            -->
            <AbsoluteLayout ref="segmentRef" row="1" class="segment">
              <View ref="pillRef" class="segment-pill" />
              <StackLayout orientation="horizontal" class="segment-items">
                <Label
                  v-for="scale in scales"
                  :key="scale.value"
                  :text="scale.label"
                  :width="itemWidth"
                  class="segment-item"
                  :class="{ 'segment-item--active': settings.textScale === scale.value }"
                  v-press
                  @tap="settings.setTextScale(scale.value)"
                />
              </StackLayout>
            </AbsoluteLayout>
          </GridLayout>

          <!-- ── Conversation ─────────────────────────────────────────────── -->
          <Label text="Conversation" class="group-label" />

          <GridLayout columns="*, auto" class="card row">
            <StackLayout col="0">
              <Label text="Show timestamps" class="row-title" />
              <Label text="Print the time under each reply" class="row-sub" />
            </StackLayout>
            <Switch
              col="1"
              :checked="settings.showTimestamps"
              @checkedChange="onShowTimestamps"
            />
          </GridLayout>

          <GridLayout columns="*, auto" class="card row">
            <StackLayout col="0">
              <Label text="Send with Enter" class="row-title" />
              <Label text="Submit the composer from the keyboard" class="row-sub" />
            </StackLayout>
            <Switch
              col="1"
              :checked="settings.sendOnEnter"
              @checkedChange="onSendOnEnter"
            />
          </GridLayout>

          <!-- ── Gateway ──────────────────────────────────────────────────── -->
          <Label text="Gateway" class="group-label" />

          <GridLayout columns="auto, *" class="card row row--stack">
            <Icon
              col="0"
              name="dot"
              :size="8"
              :color="chatStore.isConnected ? '#0FB6D6' : '#C0392B'"
              class="status-dot"
            />
            <StackLayout col="1">
              <Label text="Omni Ai" class="row-title" />
              <Label :text="BASE_URL" class="row-mono" />
              <Label
                :text="reconnectMessage || (chatStore.isConnected ? 'Connected' : 'Not reachable')"
                class="row-sub"
              />
            </StackLayout>
          </GridLayout>

          <GridLayout columns="*, auto" class="card row" v-press @tap="reconnect">
            <Label col="0" text="Reconnect" class="row-title" />
            <Label
              col="1"
              :text="reconnecting ? '…' : 'Run'"
              class="row-action"
            />
          </GridLayout>

          <!-- ── Data ─────────────────────────────────────────────────────── -->
          <Label text="Data" class="group-label" />

          <GridLayout columns="*, auto" class="card row" v-press @tap="clearHistory">
            <StackLayout col="0">
              <Label text="Clear chat history" class="row-title" />
              <Label text="Removes every stored conversation" class="row-sub" />
            </StackLayout>
            <Label col="1" text="Clear" class="row-action row-action--danger" />
          </GridLayout>

          <!-- ── About ────────────────────────────────────────────────────── -->
          <Label text="About" class="group-label" />

          <GridLayout columns="*, auto" class="card row">
            <StackLayout col="0">
              <Label text="Omni Ai client" class="row-title" />
              <Label text="NativeScript · Vue 3 · Pinia" class="row-sub" />
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
  background-color: #f2f3f6;
}

/* ---------- Header ---------- */
.screen-header {
  background-color: #ffffff;
  border-bottom-width: 1;
  border-bottom-color: #e9ebef;
  padding: 14 16;
}

.back-button {
  width: 30;
  height: 30;
  vertical-align: center;
}

.screen-title {
  color: #0f1115;
  font-size: 17;
  font-weight: 700;
  vertical-align: center;
}

.screen-scroll {
  background-color: #f2f3f6;
}

.body {
  padding: 16 16 32 16;
  animation-name: screenRise;
  animation-duration: 420ms;
  animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
  animation-fill-mode: both;
}

@keyframes screenRise {
  from {
    opacity: 0;
    transform: translate(0, 14);
  }
  to {
    opacity: 1;
    transform: translate(0, 0);
  }
}

/* ---------- Groups ---------- */
.group-label {
  color: #9aa1ad;
  font-family: monospace;
  font-size: 10;
  letter-spacing: 0.13;
  text-transform: uppercase;
  margin-bottom: 8;
  margin-top: 14;
}

/* ---------- Rows ---------- */
.card {
  background-color: #ffffff;
  border-radius: 14;
  border-width: 1;
  border-color: #e9ebef;
  padding: 14 16;
  margin-bottom: 8;
}

.row-title {
  color: #1b1e24;
  font-size: 15;
  vertical-align: center;
}

.row-sub {
  color: #9aa1ad;
  font-size: 12;
  margin-top: 2;
}

.row-mono {
  color: #6b7280;
  font-family: monospace;
  font-size: 11;
  margin-top: 3;
}

.row-action {
  color: #2f55f5;
  font-size: 14;
  font-weight: 700;
  vertical-align: center;
  padding-left: 12;
}

.row-action--danger {
  color: #c0392b;
}

.status-dot {
  width: 18;
  vertical-align: top;
  margin-top: 4;
}

/* ---------- Segmented control ---------- */
.segment {
  background-color: #eceef2;
  border-radius: 11;
  height: 40;
  margin-top: 12;
}

/* The white pill that slides between the options. */
.segment-pill {
  left: 1;
  top: 3;
  bottom: 3;
  width: 30;
  background-color: #ffffff;
  border-radius: 9;
}

.segment-items {
  left: 0;
  top: 0;
  height: 40;
}

.segment-item {
  color: #6b7280;
  font-size: 13;
  font-weight: 600;
  text-align: center;
  padding: 12 0;
}

.segment-item--active {
  color: #0f1115;
  font-weight: 700;
}
</style>
