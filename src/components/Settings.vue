<script lang="ts" setup>
/**
 * Settings screen.
 *
 * Everything on this screen is real: the text size changes the interface,
 * the switches change how the chat behaves, and the data section actually
 * clears the stored conversations.
 */
import { ref, onMounted, nextTick } from 'vue';
import { $navigateBack } from 'nativescript-vue';
import { useChatStore } from '../stores/chat';
import { useSettingsStore, type TextScale } from '../stores/settings';
import { omniAi, BASE_URL } from '../services/omni-ai';
import { enter, pulse } from '../utils/motion';
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

/** The segmented control, so the picked option can be popped. */
const segmentRef = ref<any>(null);
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

onMounted(() => {
  nextTick(() => {
    enter(bodyRef.value?.nativeView, { distance: 16, duration: 420 });
  });
});

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
        <StackLayout ref="bodyRef" class="body">
          <!-- ── Appearance ───────────────────────────────────────────────── -->
          <Label text="Appearance" class="group-label" />

          <GridLayout ref="cardRef" columns="*" rows="auto, auto" class="card">
            <StackLayout row="0">
              <Label text="Text size" class="row-title" />
              <Label text="Scales the conversation and the interface" class="row-sub" />
            </StackLayout>
            <!--
              The segmented control. The three options are written out one by
              one: the children of a `v-for` inside a GridLayout are all
              placed in column 0 and drawn on top of each other.
            -->
            <GridLayout ref="segmentRef" row="1" columns="*, *, *" class="segment">
              <Label
                col="0"
                text="Small"
                class="segment-item"
                :class="{ 'segment-item--active': settings.textScale === 'small' }"
                v-press
                @tap="settings.setTextScale('small'); popSegment('small')"
              />
              <Label
                col="1"
                text="Medium"
                class="segment-item"
                :class="{ 'segment-item--active': settings.textScale === 'medium' }"
                v-press
                @tap="settings.setTextScale('medium'); popSegment('medium')"
              />
              <Label
                col="2"
                text="Large"
                class="segment-item"
                :class="{ 'segment-item--active': settings.textScale === 'large' }"
                v-press
                @tap="settings.setTextScale('large'); popSegment('large')"
              />
            </GridLayout>
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

          <GridLayout rows="auto, auto, auto" columns="auto, *" class="card row">
            <Icon
              col="0"
              row="0"
              name="dot"
              :size="8"
              :color="chatStore.isConnected ? '#0FB6D6' : '#C0392B'"
              class="status-dot"
            />
            <Label col="1" row="0" text="Omni Ai" class="row-title" />
            <Label col="1" row="1" :text="BASE_URL" class="row-mono" />
            <Label
              col="1"
              row="2"
              :text="reconnectMessage || (chatStore.isConnected ? 'Connected' : 'Not reachable')"
              class="row-sub"
            />
          </GridLayout>

          <GridLayout columns="*, auto" class="card row" v-press @tap="reconnect">
            <Label col="0" text="Reconnect" class="row-title" />
            <Label
              col="1"
              :text="reconnecting ? '…' : 'Retry'"
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
  margin-right: 6;
  vertical-align: center;
}

/* ---------- Segmented control ---------- */
.segment {
  background-color: #eceef2;
  border-radius: 11;
  padding: 3;
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
  padding: 9 0;
  border-radius: 9;
  margin-right: 2;
}

.segment-item--active {
  background-color: #ffffff;
  color: #0f1115;
  font-weight: 700;
}
</style>
