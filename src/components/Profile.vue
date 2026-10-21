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
      <!-- ── Top app bar ────────────────────────────────────────────────── -->
      <GridLayout row="0" columns="auto, *" class="md-top-bar">
        <GridLayout col="0" columns="auto" class="md-icon-button" v-press @tap="back">
          <Icon col="0" name="chevron-left" :size="22" tone="on-surface-variant" />
        </GridLayout>
        <Label col="1" text="Profile" class="md-top-bar-title" />
      </GridLayout>

      <ScrollView row="1" class="screen-scroll">
        <StackLayout ref="bodyRef" class="body">
          <!-- ── Identity ─────────────────────────────────────────────────── -->
          <GridLayout columns="auto, *" class="md-card identity">
            <Label col="0" :text="settings.initials" class="avatar" />
            <StackLayout col="1">
              <Label :text="settings.displayName" class="identity-name" />
              <Label text="Local gateway · Omni Ai" class="identity-sub" />
            </StackLayout>
          </GridLayout>

          <!-- ── Stats ───────────────────────────────────────────────────── -->
          <GridLayout columns="*, *, *" class="stats">
            <StackLayout col="0" class="md-card stat">
              <Label :text="`${chatStore.history.length}`" class="stat-value" />
              <Label text="Chats" class="stat-label" />
            </StackLayout>
            <StackLayout col="1" class="md-card stat">
              <Label :text="`${chatStore.totalMessages}`" class="stat-value" />
              <Label text="Messages" class="stat-label" />
            </StackLayout>
            <StackLayout col="2" class="md-card stat">
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
          <GridLayout rows="auto, auto" columns="auto, *" class="md-card route">
            <Label col="0" row="0" colSpan="2" :text="currentRoute.provider" class="route-provider" />
            <Icon col="0" row="1" name="dot" :size="10" tone="primary" class="route-dot" />
            <Label col="1" row="1" :text="currentRoute.name" class="route-name" />
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
  padding: 16;
}

/* ---------- Identity ---------- */
.identity {
  align-content: center;
  margin-bottom: 12;
}

.avatar {
  width: 56;
  height: 56;
  border-radius: 28;
  background-color: var(--md-primary-container);
  color: var(--md-on-primary-container);
  font-size: 20;
  font-weight: 700;
  text-align: center;
  vertical-align: center;
  margin-right: 16;
}

.identity-name {
  color: var(--md-on-surface);
  font-size: 20;
  font-weight: 600;
  vertical-align: center;
}

.identity-sub {
  color: var(--md-on-surface-variant);
  font-size: 12;
  margin-top: 3;
}

/* ---------- Stats ---------- */
.stats {
  margin-bottom: 20;
}

.stat {
  text-align: center;
  margin-right: 8;
  padding: 14 6;
}

.stat-value {
  color: var(--md-on-surface);
  font-size: 22;
  font-weight: 700;
}

.stat-label {
  color: var(--md-on-surface-variant);
  font-size: 11;
  font-weight: 500;
  letter-spacing: 0.06;
  text-transform: uppercase;
  margin-top: 4;
}

/* ---------- Fields ---------- */
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
  margin-bottom: 20;
}

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

/* ---------- Route ---------- */
.route {
  align-content: center;
}

.route-dot {
  margin-right: 8;
  vertical-align: center;
}

.route-provider {
  color: var(--md-primary);
  font-size: 11;
  font-weight: 600;
  letter-spacing: 0.08;
  text-transform: uppercase;
  margin-bottom: 6;
}

.route-name {
  color: var(--md-on-surface);
  font-size: 16;
  font-weight: 500;
}
</style>
