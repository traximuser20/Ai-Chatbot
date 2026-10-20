<script lang="ts" setup>
/**
 * Profile screen.
 *
 * The app talks to a gateway on the developer's own machine, so there is no
 * real account behind it. The profile is therefore about the *operator*: the
 * display name shown in the interface, the gateway identity and a few facts
 * about the local history.
 */
import { computed, ref, onMounted, nextTick } from 'vue';
import { $navigateBack } from 'nativescript-vue';
import { useChatStore } from '../stores/chat';
import { useSettingsStore } from '../stores/settings';
import { providerOf } from '../utils/accent';
import { enter } from '../utils/motion';
import Icon from './Icon.vue';

const chatStore = useChatStore();
const settings = useSettingsStore();

const emit = defineEmits<{ saved: [] }>();

const nameDraft = ref(settings.displayName);
const saved = ref(false);

/** The body of the screen, so it can rise into place. */
const bodyRef = ref<any>(null);

onMounted(() => {
  nextTick(() => enter(bodyRef.value?.nativeView, { distance: 16, duration: 420 }));
});

/** Distinct providers the user has talked to so far. */
const providerCount = computed(() => {
  const providers = new Set<string>();
  chatStore.history.forEach((conversation) => {
    conversation.messages.forEach((message) => {
      if (message.model) {
        providers.add(providerOf(message.model));
      }
    });
  });
  return providers.size;
});

const currentRoute = computed(() => {
  const provider = providerOf(chatStore.model);
  const slash = chatStore.model.indexOf('/');
  return {
    provider,
    name: slash > -1 ? chatStore.model.slice(slash + 1) : chatStore.model,
  };
});

function saveName() {
  settings.setDisplayName(nameDraft.value);
  nameDraft.value = settings.displayName;
  saved.value = true;
  emit('saved');
  setTimeout(() => (saved.value = false), 1600);
}

function back() {
  $navigateBack();
}
</script>

<template>
  <Page actionBarHidden="true" class="screen">
    <GridLayout rows="auto, *">
      <!-- ── Header ─────────────────────────────────────────────────────── -->
      <GridLayout row="0" columns="auto, *" class="screen-header">
        <GridLayout col="0" columns="auto" class="back-button" v-press @tap="back">
          <Icon col="0" name="chevron-left" :size="19" tone="ink" />
        </GridLayout>
        <Label col="1" text="Profile" class="screen-title" />
      </GridLayout>

      <ScrollView row="1" class="screen-scroll">
        <StackLayout ref="bodyRef" class="body">
          <!-- ── Identity ─────────────────────────────────────────────────── -->
          <GridLayout columns="auto, *" class="card identity">
            <Label col="0" :text="settings.initials" class="avatar" />
            <StackLayout col="1">
              <Label :text="settings.displayName" class="identity-name" />
              <Label text="Local gateway · Omni Ai" class="identity-sub" />
            </StackLayout>
          </GridLayout>

          <!-- ── Stats ───────────────────────────────────────────────────── -->
          <GridLayout columns="*, *, *" class="stats">
            <StackLayout col="0" class="stat">
              <Label :text="`${chatStore.history.length}`" class="stat-value" />
              <Label text="Chats" class="stat-label" />
            </StackLayout>
            <StackLayout col="1" class="stat">
              <Label :text="`${chatStore.totalMessages}`" class="stat-value" />
              <Label text="Messages" class="stat-label" />
            </StackLayout>
            <StackLayout col="2" class="stat">
              <Label :text="`${providerCount}`" class="stat-value" />
              <Label text="Providers" class="stat-label" />
            </StackLayout>
          </GridLayout>

          <!-- ── Display name ────────────────────────────────────────────── -->
          <Label text="Display name" class="field-label" />
          <GridLayout columns="*, auto" class="field-row">
            <TextField
              col="0"
              v-model="nameDraft"
              class="field"
              hint="Your name"
              returnKeyType="done"
              @submit="saveName"
            />
            <Label
              col="1"
              :text="saved ? 'Saved' : 'Save'"
              class="field-action"
              :class="{ 'field-action--saved': saved }"
              v-press
              @tap="saveName"
            />
          </GridLayout>
          <!-- ── Active route ───────────────────────────────────────────── -->
          <Label text="Active route" class="field-label" />
          <GridLayout rows="auto, auto" columns="auto, *" class="card route">
            <Label col="0" row="0" colSpan="2" :text="currentRoute.provider" class="route-provider" />
            <Icon col="0" row="1" name="dot" :size="8" tone="live" class="route-dot" />
            <Label col="1" row="1" :text="currentRoute.name" class="route-name" />
          </GridLayout>
        </StackLayout>
      </ScrollView>
    </GridLayout>
  </Page>
</template>

<style scoped>
.screen {
  background-color: var(--app-canvas);
}

/* ---------- Header ---------- */
.screen-header {
  background-color: var(--app-surface);
  border-bottom-width: 1;
  border-bottom-color: var(--app-border);
  padding: 14 16;
}

.back-button {
  width: 30;
  height: 30;
  vertical-align: center;
}

.screen-title {
  color: var(--app-ink-strong);
  font-size: 17;
  font-weight: 700;
  vertical-align: center;
}

.screen-scroll {
  background-color: var(--app-canvas);
}

.body {
  padding: 16;
}

/* ---------- Card ---------- */
.card {
  background-color: var(--app-surface);
  border-radius: 14;
  border-width: 1;
  border-color: var(--app-border);
  padding: 16;
  margin-bottom: 12;
}

/* ---------- Identity ---------- */
.avatar {
  width: 54;
  height: 54;
  border-radius: 27;
  background-color: var(--app-ink-strong);
  color: var(--app-on-ink);
  font-family: monospace;
  font-size: 18;
  font-weight: 700;
  text-align: center;
  vertical-align: center;
  margin-right: 14;
}

.identity-name {
  color: var(--app-ink-strong);
  font-size: 18;
  font-weight: 700;
  vertical-align: center;
}

.identity-sub {
  color: var(--app-ink-muted);
  font-family: monospace;
  font-size: 11;
  margin-top: 3;
}

/* ---------- Stats ---------- */
.stats {
  margin-bottom: 20;
}

.stat {
  background-color: var(--app-surface);
  border-radius: 14;
  border-width: 1;
  border-color: var(--app-border);
  padding: 14 8;
  text-align: center;
  margin-right: 8;
}

.stat-value {
  color: var(--app-ink-strong);
  font-family: monospace;
  font-size: 20;
  font-weight: 700;
}

.stat-label {
  color: var(--app-ink-muted);
  font-family: monospace;
  font-size: 9;
  letter-spacing: 0.12;
  text-transform: uppercase;
  margin-top: 4;
}

/* ---------- Fields ---------- */
.field-label {
  color: var(--app-ink-muted);
  font-family: monospace;
  font-size: 10;
  letter-spacing: 0.13;
  text-transform: uppercase;
  margin-bottom: 8;
  margin-top: 4;
}

.field-row {
  margin-bottom: 20;
}

.field {
  background-color: var(--app-surface);
  border-width: 1;
  border-color: var(--app-border-2);
  border-radius: 12;
  color: var(--app-ink);
  font-size: 15;
  padding: 12 14;
  /* The field fills the row, the action sits next to it. */
  width: 100%;
}

.field-action {
  color: var(--app-link);
  font-size: 13;
  font-weight: 700;
  vertical-align: center;
  margin-left: 12;
  text-align: right;
}

.field-action--saved {
  color: var(--app-success);
}

/* ---------- Route ---------- */
.route-dot {
  margin-right: 6;
  vertical-align: center;
}

.route-provider {
  color: var(--app-ink-muted);
  font-family: monospace;
  font-size: 10;
  letter-spacing: 0.1;
  text-transform: uppercase;
  margin-bottom: 4;
}

.route-name {
  color: var(--app-ink-strong);
  font-family: monospace;
  font-size: 15;
  margin-top: 2;
}
</style>
