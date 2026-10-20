<script lang="ts" setup>
/**
 * Model picker - a bottom sheet listing every route the gateway exposes.
 *
 * The gateway publishes several hundred models, so the list is rendered with a
 * `ListView` (which recycles its rows) and can be filtered by a search field.
 * Each row carries the accent colour of its provider, which makes the list
 * scannable by colour.
 */
import { computed, ref, onMounted } from 'vue';
import type { OmniAiModel } from '../services/omni-ai';
import { providerOf } from '../utils/accent';
import Icon from './Icon.vue';

const props = defineProps<{
  models: OmniAiModel[];
  /** Currently selected model id. */
  selected: string;
  loading?: boolean;
  /** Accent colour of the active provider. */
  accent?: string;
}>();

const emit = defineEmits<{
  close: [];
  select: [model: OmniAiModel];
}>();

const filter = ref('');

const filtered = computed(() => {
  const term = filter.value.trim().toLowerCase();
  if (!term) {
    return props.models;
  }
  return props.models.filter((model) => model.id.toLowerCase().includes(term));
});

/** Provider prefix of a model id. */
function providerOfModel(model: OmniAiModel): string {
  return providerOf(model.id);
}

/** The sheet, so it can slide up into place. */
const sheetRef = ref<any>(null);
const backdropRef = ref<any>(null);

onMounted(() => {
  const sheet = sheetRef.value?.nativeView;
  const backdrop = backdropRef.value?.nativeView;

  if (backdrop) {
    backdrop.opacity = 0;
    backdrop.animate({ opacity: 1, duration: 200, curve: 'easeOut' });
  }

  if (sheet) {
    // The sheet rises from the bottom of the screen.
    sheet.translateY = 240;
    sheet.animate(
      { translate: { x: 0, y: 0 }, duration: 320, curve: 'easeOut' },
    );
  }
});
</script>

<template>
  <GridLayout ref="backdropRef" class="sheet-backdrop" @tap="emit('close')">
    <GridLayout ref="sheetRef" class="sheet" rows="auto, auto, auto, *" @tap="() => {}">
      <!-- Drag handle -->
      <Label row="0" class="sheet-handle" />

      <!-- Title row -->
      <GridLayout row="1" columns="*, auto" class="sheet-head">
        <StackLayout col="0">
          <Label text="Select a model" class="sheet-title" />
          <Label
            :text="loading ? 'loading routes…' : `${models.length} routes available`"
            class="sheet-subtitle"
          />
        </StackLayout>
        <GridLayout
          col="1"
          columns="auto"
          class="sheet-close"
          v-press
          @tap="emit('close')"
        >
          <Icon col="0" name="close" :size="17" color="#8D94A0" />
        </GridLayout>
      </GridLayout>

      <!-- Search -->
      <GridLayout row="2" columns="auto, *" class="sheet-search">
        <Icon col="0" name="search" :size="16" color="#9AA1AD" class="sheet-search-icon" />
        <TextField
          col="1"
          v-model="filter"
          hint="Search models"
          class="sheet-search-field"
          returnKeyType="search"
        />
      </GridLayout>

      <!-- Routes -->
      <ListView v-if="filtered.length" row="3" class="sheet-list" :items="filtered">
        <template #default="{ item: model }">
          <!--
            The provider and the model id are two rows of their own, so the
            dot can sit on the provider line and the tick on the model line.

            `width: 100%` keeps the row inside the sheet: a ListView measures
            its items without a width, so a long model id would push the tick
            off the edge.
          -->
          <GridLayout
            rows="auto, auto"
            columns="auto, *, auto"
            class="model-row"
            :class="{ 'model-row--active': model.id === selected }"
            v-press
            @tap="emit('select', model)"
          >
            <Icon
              col="0"
              row="0"
              name="dot"
              :size="7"
              :color="accent ?? '#2F55F5'"
              class="model-dot"
            />
            <Label
              col="1"
              row="0"
              :text="providerOfModel(model)"
              class="model-provider"
            />
            <Label
              col="1"
              row="1"
              :text="model.id"
              textWrap="true"
              class="model-id"
            />
            <GridLayout
              v-if="model.id === selected"
              col="2"
              row="0"
              rowSpan="2"
              columns="auto"
              class="model-check"
            >
              <Icon col="0" name="check" :size="15" :color="accent ?? '#2F55F5'" />
            </GridLayout>
          </GridLayout>
        </template>
      </ListView>

      <StackLayout v-else row="3" class="sheet-empty">
        <Label
          :text="loading ? 'Loading models…' : 'No model matches your search.'"
          class="sheet-empty-text"
        />
      </StackLayout>
    </GridLayout>
  </GridLayout>
</template>

<style scoped>
.sheet-backdrop {
  background-color: rgba(12, 14, 18, 0.45);
  horizontal-align: stretch;
  vertical-align: stretch;
}

.sheet {
  background-color: #ffffff;
  border-top-left-radius: 22;
  border-top-right-radius: 22;
  horizontal-align: stretch;
  vertical-align: bottom;
  height: 72%;
  padding: 0 16 12 16;
}

.sheet-handle {
  width: 40;
  height: 4;
  border-radius: 2;
  background-color: #dfe2e8;
  margin-top: 10;
  margin-bottom: 8;
  horizontal-align: center;
}

.sheet-head {
  padding-bottom: 10;
}

.sheet-title {
  color: #0f1115;
  font-size: 18;
  font-weight: 700;
}

.sheet-subtitle {
  color: #9aa1ad;
  font-family: monospace;
  font-size: 10;
  letter-spacing: 0.08;
  margin-top: 3;
}

.sheet-close {
  width: 32;
  height: 32;
  vertical-align: center;
}

/* ---------- Search ---------- */
.sheet-search {
  background-color: #f2f3f6;
  border-radius: 12;
  padding: 0 12;
  margin-bottom: 10;
}

.sheet-search-icon {
  width: 22;
  vertical-align: center;
}

.sheet-search-field {
  background-color: transparent;
  border-width: 0;
  color: #1b1e24;
  font-size: 14;
  padding: 10 0;
  vertical-align: center;
}

/* ---------- Rows ---------- */
.sheet-list {
  margin-bottom: 4;
}

.model-row {
  width: 100%;
  padding: 10 8;
  border-radius: 10;
}

.model-row--active {
  background-color: #f4f5f8;
}

.model-dot {
  margin-right: 6;
  vertical-align: center;
  opacity: 0.7;
}

.model-provider {
  color: #9aa1ad;
  font-family: monospace;
  font-size: 9;
  letter-spacing: 0.1;
  text-transform: uppercase;
}

.model-id {
  color: #1b1e24;
  font-family: monospace;
  font-size: 13;
  margin-top: 2;
}

.model-check {
  width: 24;
  vertical-align: center;
}

.sheet-empty {
  padding: 28 0;
}

.sheet-empty-text {
  color: #9aa1ad;
  font-size: 13;
  text-align: center;
}
</style>
