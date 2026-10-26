<script lang="ts" setup>
/**
 * Model usage screen.
 *
 * The gateway publishes several hundred routes, and the app keeps a local
 * history of every conversation. This screen turns that history into a
 * picture of *which routes were actually used*: how many replies each one
 * produced, its share of the total, and the same breakdown by provider.
 *
 * Everything is derived from the stored conversations, so the screen needs no
 * network call and is accurate even when the gateway is offline.
 */
import { computed, ref, onMounted, nextTick } from 'vue';
import { $navigateBack } from 'nativescript-vue';
import { useChatStore } from '../stores/chat';
import { providerOf, accentFor } from '../utils/accent';
import { enter } from '../utils/motion';
import Icon from './Icon.vue';

const chatStore = useChatStore();

const bodyRef = ref<any>(null);

onMounted(() => {
  nextTick(() => {
    const candidates = [bodyRef.value, bodyRef.value?.nativeView];
    const view = candidates.find((candidate) => candidate && typeof candidate.animate === 'function');
    if (view) {
      enter(view, { distance: 16, duration: 420 });
    }
  });
});

function back() {
  $navigateBack();
}

/* ------------------------------------------------------------------ */
/* Aggregates                                                          */
/* ------------------------------------------------------------------ */

/** Replies attributed to each model. */
const replyCounts = computed(() => {
  const map = new Map<string, number>();
  for (const conversation of chatStore.history) {
    for (const message of conversation.messages) {
      if (message.sender === 'ai' && message.model) {
        map.set(message.model, (map.get(message.model) ?? 0) + 1);
      }
    }
  }
  return map;
});

/** Conversations whose last model was each route. */
const conversationCounts = computed(() => {
  const map = new Map<string, number>();
  for (const conversation of chatStore.history) {
    if (conversation.model) {
      map.set(conversation.model, (map.get(conversation.model) ?? 0) + 1);
    }
  }
  return map;
});

const totalReplies = computed(() =>
  [...replyCounts.value.values()].reduce((sum, value) => sum + value, 0),
);

interface ModelUsageRow {
  model: string;
  provider: string;
  color: string;
  replies: number;
  conversations: number;
}

const modelUsage = computed<ModelUsageRow[]>(() => {
  const models = new Set<string>([
    ...replyCounts.value.keys(),
    ...conversationCounts.value.keys(),
  ]);
  const rows = [...models].map((model) => ({
    model,
    provider: providerOf(model),
    color: accentFor(model),
    replies: replyCounts.value.get(model) ?? 0,
    conversations: conversationCounts.value.get(model) ?? 0,
  }));
  rows.sort((a, b) => b.replies - a.replies || a.model.localeCompare(b.model));
  return rows;
});

interface ProviderUsageRow {
  provider: string;
  color: string;
  replies: number;
  models: number;
}

const providerUsage = computed<ProviderUsageRow[]>(() => {
  const map = new Map<string, { replies: number; models: Set<string> }>();
  for (const row of modelUsage.value) {
    const entry = map.get(row.provider) ?? { replies: 0, models: new Set<string>() };
    entry.replies += row.replies;
    entry.models.add(row.model);
    map.set(row.provider, entry);
  }
  const rows = [...map.entries()].map(([provider, entry]) => ({
    provider,
    color: accentFor(provider),
    replies: entry.replies,
    models: entry.models.size,
  }));
  rows.sort((a, b) => b.replies - a.replies || a.provider.localeCompare(b.provider));
  return rows;
});

const distinctModels = computed(() => modelUsage.value.length);
const distinctProviders = computed(() => providerUsage.value.length);
const totalChats = computed(() => chatStore.history.length);
const totalMessages = computed(() => chatStore.totalMessages);
const topModel = computed(() => modelUsage.value[0]);

const hasUsage = computed(() => totalReplies.value > 0);

const MAX_BAR = 200;
const COMPOSE_MAX = 320;

function barWidth(count: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return Math.max(4, Math.round((count / total) * MAX_BAR));
}

function composeWidth(count: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return Math.max(2, Math.round((count / total) * COMPOSE_MAX));
}

function pct(count: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return Math.round((count / total) * 100);
}

function shortName(model: string): string {
  const slash = model.indexOf('/');
  return slash > -1 ? model.slice(slash + 1) : model;
}

function rankClass(index: number): string {
  if (index === 0) return 'rank--primary';
  if (index === 1) return 'rank--secondary';
  if (index === 2) return 'rank--tertiary';
  return 'rank--muted';
}
</script>

<template>
  <Page actionBarHidden="true" class="screen">
    <GridLayout rows="auto, *">
      <!-- ── Top app bar ────────────────────────────────────────────────── -->
      <GridLayout row="0" columns="auto, *" class="md-top-bar">
        <GridLayout col="0" columns="*" rows="*" class="md-icon-button" v-press @tap="back">
          <Icon col="0" name="chevron-left" :size="22" tone="on-surface-variant" />
        </GridLayout>
        <Label col="1" text="Model usage" class="md-top-bar-title" />
      </GridLayout>

      <ScrollView row="1" class="screen-scroll">
        <StackLayout ref="bodyRef" class="body">
          <!-- ── Hero ───────────────────────────────────────────────────── -->
          <GridLayout ref="heroRef" columns="auto, *" class="hero">
            <ContentView col="0" class="hero-tile">
              <Icon name="chart" :size="26" tone="on-primary" />
            </ContentView>
            <StackLayout col="1" class="hero-body">
              <Label :text="`${totalReplies}`" class="hero-number" />
              <Label
                :text="`replies across ${distinctModels} ${
                  distinctModels === 1 ? 'model' : 'models'
                } · ${distinctProviders} ${
                  distinctProviders === 1 ? 'provider' : 'providers'
                }`"
                class="hero-sub"
                textWrap="true"
              />
            </StackLayout>
          </GridLayout>

          <!-- ── Composition bar ─────────────────────────────────────────── -->
          <StackLayout v-if="hasUsage" class="compose-card">
            <Label text="Share by provider" class="compose-label" />
            <StackLayout orientation="horizontal" class="compose-bar">
              <ContentView
                v-for="row in providerUsage"
                :key="`compose-${row.provider}`"
                class="compose-segment"
                :width="composeWidth(row.replies, totalReplies)"
                :style="{ backgroundColor: row.color }"
              />
            </StackLayout>
            <WrapLayout class="compose-legend">
              <GridLayout
                v-for="row in providerUsage"
                :key="`legend-${row.provider}`"
                columns="auto, auto"
                class="legend-item"
              >
                <ContentView
                  col="0"
                  class="legend-dot"
                  :style="{ backgroundColor: row.color }"
                />
                <Label
                  col="1"
                  :text="`${row.provider} ${pct(row.replies, totalReplies)}%`"
                  class="legend-text"
                />
              </GridLayout>
            </WrapLayout>
          </StackLayout>

          <!-- ── Summary tiles ───────────────────────────────────────────── -->
          <GridLayout columns="*, *, *" class="tiles">
            <StackLayout col="0" class="tile">
              <Label :text="`${totalChats}`" class="tile-value" />
              <Label text="Chats" class="tile-label" />
            </StackLayout>
            <StackLayout col="1" class="tile">
              <Label :text="`${totalMessages}`" class="tile-value" />
              <Label text="Messages" class="tile-label" />
            </StackLayout>
            <StackLayout col="2" class="tile">
              <Label :text="`${totalReplies}`" class="tile-value" />
              <Label text="Replies" class="tile-label" />
            </StackLayout>
          </GridLayout>

          <!-- ── Top route ───────────────────────────────────────────────── -->
          <GridLayout v-if="topModel" columns="auto, *" class="top-route">
            <ContentView col="0" class="top-tile">
              <Label :text="`1`" class="top-rank" />
            </ContentView>
            <StackLayout col="1" class="top-body">
              <Label text="Most used route" class="top-eyebrow" />
              <Label :text="shortName(topModel.model)" class="top-name" />
              <Label
                :text="`${topModel.provider} · ${topModel.replies} replies · ${pct(
                  topModel.replies,
                  totalReplies,
                )}% of all usage`"
                class="top-meta"
                textWrap="true"
              />
              <StackLayout orientation="horizontal" class="top-bar">
                <ContentView
                  class="top-bar-fill"
                  :width="barWidth(topModel.replies, totalReplies)"
                  :style="{ backgroundColor: topModel.color }"
                />
              </StackLayout>
            </StackLayout>
          </GridLayout>

          <!-- ── Empty state ─────────────────────────────────────────────── -->
          <StackLayout v-if="!hasUsage" class="empty">
            <ContentView class="empty-tile">
              <Icon name="chart" :size="28" tone="on-surface-variant" />
            </ContentView>
            <Label text="No usage yet" class="empty-title" />
            <Label
              text="Start a conversation and the routes you talk to will show up here, with their share of the total."
              class="empty-text"
              textWrap="true"
            />
          </StackLayout>

          <!-- ── By provider ─────────────────────────────────────────────── -->
          <template v-if="hasUsage">
            <GridLayout columns="*, auto" class="section-head">
              <Label col="0" text="By provider" class="group-label" />
              <Label
                col="1"
                :text="`${distinctProviders}`"
                class="section-count"
              />
            </GridLayout>
            <StackLayout class="card list">
              <GridLayout
                v-for="(row, index) in providerUsage"
                :key="row.provider"
                columns="auto, *, auto"
                class="usage-row"
                :class="{ 'usage-row--last': index === providerUsage.length - 1 }"
              >
                <ContentView
                  col="0"
                  class="usage-dot"
                  :style="{ backgroundColor: row.color }"
                />
                <StackLayout col="1" class="usage-body">
                  <GridLayout columns="*, auto" class="usage-head">
                    <Label :text="row.provider" class="usage-name" />
                    <Label
                      :text="`${row.models} ${row.models === 1 ? 'model' : 'models'}`"
                      class="usage-sub"
                    />
                  </GridLayout>
                  <StackLayout orientation="horizontal" class="bar-track">
                    <ContentView
                      class="bar-fill"
                      :width="barWidth(row.replies, totalReplies)"
                      :style="{ backgroundColor: row.color }"
                    />
                  </StackLayout>
                </StackLayout>
                <StackLayout col="2" class="usage-meta">
                  <Label :text="`${row.replies}`" class="usage-count" />
                  <Label :text="`${pct(row.replies, totalReplies)}%`" class="usage-pct" />
                </StackLayout>
              </GridLayout>
            </StackLayout>

            <!-- ── By model ──────────────────────────────────────────────── -->
            <GridLayout columns="*, auto" class="section-head">
              <Label col="0" text="By model" class="group-label" />
              <Label
                col="1"
                :text="`${distinctModels}`"
                class="section-count"
              />
            </GridLayout>
            <StackLayout class="card list">
              <GridLayout
                v-for="(row, index) in modelUsage"
                :key="row.model"
                columns="auto, *, auto"
                class="usage-row"
                :class="{ 'usage-row--last': index === modelUsage.length - 1 }"
              >
                <Label
                  col="0"
                  :text="`${index + 1}`"
                  class="rank"
                  :class="rankClass(index)"
                />
                <StackLayout col="1" class="usage-body">
                  <GridLayout columns="*, auto" class="usage-head">
                    <Label :text="shortName(row.model)" class="usage-name" />
                    <Label :text="row.provider" class="usage-sub" />
                  </GridLayout>
                  <StackLayout orientation="horizontal" class="bar-track">
                    <ContentView
                      class="bar-fill"
                      :width="barWidth(row.replies, totalReplies)"
                      :style="{ backgroundColor: row.color }"
                    />
                  </StackLayout>
                  <Label
                    v-if="row.conversations"
                    :text="`${row.conversations} ${
                      row.conversations === 1 ? 'chat' : 'chats'
                    }`"
                    class="usage-foot"
                  />
                </StackLayout>
                <StackLayout col="2" class="usage-meta">
                  <Label :text="`${row.replies}`" class="usage-count" />
                  <Label :text="`${pct(row.replies, totalReplies)}%`" class="usage-pct" />
                </StackLayout>
              </GridLayout>
            </StackLayout>
          </template>
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
  padding: 12 16 32 16;
}

/* ---------- Hero ---------- */
.hero {
  background-color: var(--md-surface-container-low);
  border-radius: 20;
  padding: 18 20;
  margin-bottom: 14;
  align-content: center;
  elevation: 1;
}

.hero-tile {
  width: 52;
  height: 52;
  border-radius: 16;
  background-color: var(--md-primary);
  margin-right: 16;
  horizontal-align: center;
  vertical-align: center;
}

.hero-body {
  vertical-align: center;
}

.hero-number {
  color: var(--md-on-surface);
  font-size: 34;
  font-weight: 700;
  letter-spacing: -0.02;
  line-height: 1.05;
}

.hero-sub {
  color: var(--md-on-surface-variant);
  font-size: 13;
  margin-top: 4;
  line-height: 1.3;
}

/* ---------- Composition ---------- */
.compose-card {
  background-color: var(--md-surface-container-low);
  border-radius: 20;
  padding: 16 18;
  margin-bottom: 14;
}

.compose-label {
  color: var(--md-on-surface-variant);
  font-size: 11;
  font-weight: 600;
  letter-spacing: 0.08;
  text-transform: uppercase;
  margin-bottom: 10;
}

.compose-bar {
  height: 14;
  border-radius: 7;
  overflow: hidden;
  background-color: var(--md-surface-container-highest);
  horizontal-align: stretch;
}

.compose-segment {
  height: 14;
}

.compose-legend {
  margin-top: 12;
}

.legend-item {
  margin: 0 12 6 0;
  vertical-align: center;
}

.legend-dot {
  width: 8;
  height: 8;
  border-radius: 4;
  margin-right: 6;
  vertical-align: center;
}

.legend-text {
  color: var(--md-on-surface-variant);
  font-size: 11;
  font-weight: 500;
  vertical-align: center;
}

/* ---------- Tiles ---------- */
.tiles {
  margin-bottom: 14;
}

.tile {
  background-color: var(--md-surface-container-low);
  border-radius: 16;
  padding: 12 6;
  margin: 0 4;
  text-align: center;
}

.tile-value {
  color: var(--md-on-surface);
  font-size: 20;
  font-weight: 700;
}

.tile-label {
  color: var(--md-on-surface-variant);
  font-size: 10;
  font-weight: 600;
  letter-spacing: 0.06;
  text-transform: uppercase;
  margin-top: 3;
}

/* ---------- Top route ---------- */
.top-route {
  background-color: var(--md-surface-container-low);
  border-radius: 20;
  padding: 16 18;
  margin-bottom: 14;
  align-content: center;
}

.top-tile {
  width: 46;
  height: 46;
  border-radius: 14;
  background-color: var(--md-primary-container);
  margin-right: 14;
  horizontal-align: center;
  vertical-align: center;
}

.top-rank {
  color: var(--md-on-primary-container);
  font-size: 20;
  font-weight: 700;
  text-align: center;
  vertical-align: center;
  horizontal-align: center;
}

.top-body {
  vertical-align: center;
}

.top-eyebrow {
  color: var(--md-primary);
  font-size: 10;
  font-weight: 700;
  letter-spacing: 0.1;
  text-transform: uppercase;
  margin-bottom: 2;
}

.top-name {
  color: var(--md-on-surface);
  font-size: 17;
  font-weight: 700;
  margin-bottom: 2;
}

.top-meta {
  color: var(--md-on-surface-variant);
  font-size: 12;
  line-height: 1.3;
}

.top-bar {
  height: 4;
  background-color: var(--md-surface-container-highest);
  border-radius: 2;
  margin-top: 8;
  horizontal-align: stretch;
}

.top-bar-fill {
  height: 4;
  border-radius: 2;
}

/* ---------- Empty ---------- */
.empty {
  padding: 30 12;
  horizontal-align: center;
}

.empty-tile {
  width: 64;
  height: 64;
  border-radius: 20;
  background-color: var(--md-surface-container-high);
  margin-bottom: 14;
  horizontal-align: center;
}

.empty-title {
  color: var(--md-on-surface);
  font-size: 18;
  font-weight: 600;
  text-align: center;
}

.empty-text {
  color: var(--md-on-surface-variant);
  font-size: 13;
  text-align: center;
  margin-top: 6;
  max-width: 280;
  line-height: 1.4;
}

/* ---------- Section heads ---------- */
.section-head {
  margin-bottom: 6;
  margin-top: 18;
  vertical-align: center;
}

.group-label {
  color: var(--md-primary);
  font-size: 12;
  font-weight: 700;
  letter-spacing: 0.1;
  text-transform: uppercase;
}

.section-count {
  min-width: 22;
  height: 22;
  padding: 0 7;
  border-radius: 11;
  background-color: var(--md-secondary-container);
  color: var(--md-on-secondary-container);
  font-size: 11;
  font-weight: 700;
  text-align: center;
  vertical-align: center;
}

/* ---------- Card ---------- */
.card {
  background-color: var(--md-surface-container-low);
  border-radius: 20;
  padding: 4 0;
  margin-bottom: 4;
}

.list {
  padding: 2 0;
}

/* ---------- Usage row ---------- */
.usage-row {
  padding: 12 16;
  vertical-align: center;
  border-bottom-width: 1;
  border-bottom-color: var(--md-outline-variant);
}

.usage-row--last {
  border-bottom-width: 0;
}

.rank {
  width: 22;
  font-size: 13;
  font-weight: 700;
  text-align: center;
  vertical-align: center;
  margin-right: 6;
}

.rank--primary {
  color: var(--md-primary);
}

.rank--secondary {
  color: var(--md-secondary);
}

.rank--tertiary {
  color: var(--md-tertiary);
}

.rank--muted {
  color: var(--md-on-surface-variant);
}

.usage-dot {
  width: 10;
  height: 10;
  border-radius: 5;
  margin-right: 12;
  vertical-align: center;
}

.usage-body {
  padding-right: 8;
}

.usage-head {
  margin-bottom: 6;
}

.usage-name {
  color: var(--md-on-surface);
  font-size: 14;
  font-weight: 600;
  vertical-align: center;
}

.usage-sub {
  color: var(--md-on-surface-variant);
  font-size: 11;
  vertical-align: center;
  text-align: right;
}

.usage-foot {
  color: var(--md-on-surface-variant);
  font-size: 11;
  margin-top: 4;
  opacity: 0.75;
}

.bar-track {
  height: 6;
  background-color: var(--md-surface-container-highest);
  border-radius: 3;
  horizontal-align: stretch;
}

.bar-fill {
  height: 6;
  border-radius: 3;
}

.usage-meta {
  width: 50;
  text-align: right;
  vertical-align: center;
  margin-left: 8;
}

.usage-count {
  color: var(--md-on-surface);
  font-size: 16;
  font-weight: 700;
  text-align: right;
}

.usage-pct {
  color: var(--md-on-surface-variant);
  font-size: 11;
  text-align: right;
  margin-top: 2;
}
</style>