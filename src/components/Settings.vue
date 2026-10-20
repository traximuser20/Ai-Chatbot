<script lang="ts" setup>
/**
 * Settings screen.
 *
 * Everything on this screen is real: the text size changes the interface,
 * the switches change how the chat behaves, and the data section actually
 * clears the stored conversations.
 */
import { ref } from 'vue';
import { $navigateBack } from 'nativescript-vue';
import { useChatStore } from '../stores/chat';
import { useSettingsStore, type TextScale } from '../stores/settings';
import { omniRoute, BASE_URL } from '../services/omniroute';

const chatStore = useChatStore();
const settings = useSettingsStore();

const reconnecting = ref(false);
const reconnectMessage = ref('');

const scales: { value: TextScale; label: string }[] = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
];

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
    const models = await omniRoute.loadModels(true);
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
        <Label col="0" text="‹" class="back-button" @tap="back" />
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
              A horizontal StackLayout is used instead of a GridLayout:
              in NativeScript-Vue the children of a 'v-for' inside a
              GridLayout are all placed in column 0 and drawn on top of each
              other (the segmented control rendered "Medium" and "Large"
              overlapping). A StackLayout lays them out left to right, and
              each label gets an equal third of the width.
            -->
            <StackLayout row="1" orientation="horizontal" class="segment">
              <Label
                v-for="scale in scales"
                :key="scale.value"
                :text="scale.label"
                class="segment-item"
                :class="{ 'segment-item--active': settings.textScale === scale.value }"
                @tap="settings.setTextScale(scale.value)"
              />
            </StackLayout>
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
            <Label col="0" text="●" class="status-dot" :class="{ 'status-dot--off': !chatStore.isConnected }" />
            <StackLayout col="1">
              <Label text="OmniRoute" class="row-title" />
              <Label :text="BASE_URL" class="row-mono" />
              <Label
                :text="reconnectMessage || (chatStore.isConnected ? 'Connected' : 'Not reachable')"
                class="row-sub"
              />
            </StackLayout>
          </GridLayout>

          <GridLayout columns="*, auto" class="card row">
            <Label col="0" text="Reconnect" class="row-title" />
            <Label
              col="1"
              :text="reconnecting ? '…' : 'Run'"
              class="row-action"
              @tap="reconnect"
            />
          </GridLayout>

          <!-- ── Data ─────────────────────────────────────────────────────── -->
          <Label text="Data" class="group-label" />

          <GridLayout columns="*, auto" class="card row">
            <StackLayout col="0">
              <Label text="Clear chat history" class="row-title" />
              <Label text="Removes every stored conversation" class="row-sub" />
            </StackLayout>
            <Label col="1" text="Clear" class="row-action row-action--danger" @tap="clearHistory" />
          </GridLayout>

          <!-- ── About ────────────────────────────────────────────────────── -->
          <Label text="About" class="group-label" />

          <GridLayout columns="*, auto" class="card row">
            <StackLayout col="0">
              <Label text="OmniRoute client" class="row-title" />
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
  color: #1b1e24;
  font-size: 26;
  width: 30;
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
  color: #0e8f6e;
  font-size: 9;
  width: 18;
  vertical-align: top;
  margin-top: 4;
}

.status-dot--off {
  color: #c0392b;
}

/* ---------- Segmented control ---------- */
.segment {
  background-color: #eceef2;
  border-radius: 11;
  padding: 3;
  margin-top: 12;
}

.segment-item {
  color: #6b7280;
  font-size: 13;
  font-weight: 600;
  text-align: center;
  padding: 9 0;
  border-radius: 9;
  /* Equal thirds of the control, minus the gap between the segments. */
  width: 33%;
  margin-right: 2;
}

.segment-item--active {
  background-color: #ffffff;
  color: #0f1115;
  font-weight: 700;
}
</style>
