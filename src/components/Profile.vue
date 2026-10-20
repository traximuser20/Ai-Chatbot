<script lang="ts" setup>
/**
 * Profile screen.
 *
 * The app talks to a gateway on the developer's own machine, so there is no
 * real account behind it. The profile is therefore about the *operator*: the
 * display name shown in the interface, the gateway identity and a few facts
 * about the local history.
 */
import { computed, ref } from 'vue';
import { $navigateBack } from 'nativescript-vue';
import { useChatStore } from '../stores/chat';
import { useSettingsStore } from '../stores/settings';
import { providerOf } from '../utils/accent';

const chatStore = useChatStore();
const settings = useSettingsStore();

const emit = defineEmits<{ saved: [] }>();

const nameDraft = ref(settings.displayName);
const saved = ref(false);

/** Distinct providers the user has talked to so far. */
const providerCount = computed(() => {
  const providers = new Set<string>();
  chatStore.conversations.forEach((conversation) => {
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
        <Label col="0" text="‹" class="back-button" @tap="back" />
        <Label col="1" text="Profile" class="screen-title" />
      </GridLayout>

      <ScrollView row="1" class="screen-scroll">
        <StackLayout class="body">
          <!-- ── Identity ─────────────────────────────────────────────────── -->
          <GridLayout columns="auto, *" class="card identity">
            <Label col="0" :text="settings.initials" class="avatar" />
            <StackLayout col="1">
              <Label :text="settings.displayName" class="identity-name" />
              <Label text="Local gateway · OmniRoute" class="identity-sub" />
            </StackLayout>
          </GridLayout>

          <!-- ── Stats ───────────────────────────────────────────────────── -->
          <GridLayout columns="*, *, *" class="stats">
            <StackLayout col="0" class="stat">
              <Label :text="`${chatStore.conversations.length}`" class="stat-value" />
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
              @tap="saveName"
            />
          </GridLayout>

          <!-- ── Active route ───────────────────────────────────────────── -->
          <Label text="Active route" class="field-label" />
          <GridLayout columns="auto, *" class="card route">
            <Label col="0" text="●" class="route-dot" />
            <StackLayout col="1">
              <Label :text="currentRoute.provider" class="route-provider" />
              <Label :text="currentRoute.name" class="route-name" />
            </StackLayout>
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
  padding: 16;
}

/* ---------- Card ---------- */
.card {
  background-color: #ffffff;
  border-radius: 14;
  border-width: 1;
  border-color: #e9ebef;
  padding: 16;
  margin-bottom: 12;
}

/* ---------- Identity ---------- */
.avatar {
  width: 54;
  height: 54;
  border-radius: 27;
  background-color: #14171d;
  color: #ffffff;
  font-family: monospace;
  font-size: 18;
  font-weight: 700;
  text-align: center;
  vertical-align: center;
  margin-right: 14;
}

.identity-name {
  color: #0f1115;
  font-size: 18;
  font-weight: 700;
  vertical-align: center;
}

.identity-sub {
  color: #9aa1ad;
  font-family: monospace;
  font-size: 11;
  margin-top: 3;
}

/* ---------- Stats ---------- */
.stats {
  margin-bottom: 20;
}

.stat {
  background-color: #ffffff;
  border-radius: 14;
  border-width: 1;
  border-color: #e9ebef;
  padding: 14 8;
  text-align: center;
  margin-right: 8;
}

.stat-value {
  color: #0f1115;
  font-family: monospace;
  font-size: 20;
  font-weight: 700;
}

.stat-label {
  color: #9aa1ad;
  font-family: monospace;
  font-size: 9;
  letter-spacing: 0.12;
  text-transform: uppercase;
  margin-top: 4;
}

/* ---------- Fields ---------- */
.field-label {
  color: #9aa1ad;
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
  background-color: #ffffff;
  border-width: 1;
  border-color: #e2e5ea;
  border-radius: 12;
  color: #1b1e24;
  font-size: 15;
  padding: 12 14;
  margin-right: 10;
}

.field-action {
  color: #2f55f5;
  font-size: 14;
  font-weight: 700;
  vertical-align: center;
  width: 54;
  text-align: right;
}

.field-action--saved {
  color: #0e8f6e;
}

/* ---------- Route ---------- */
.route-dot {
  color: #0e8f6e;
  font-size: 9;
  width: 20;
  vertical-align: center;
}

.route-provider {
  color: #9aa1ad;
  font-family: monospace;
  font-size: 10;
  letter-spacing: 0.1;
  text-transform: uppercase;
}

.route-name {
  color: #0f1115;
  font-family: monospace;
  font-size: 15;
  margin-top: 2;
}
</style>
