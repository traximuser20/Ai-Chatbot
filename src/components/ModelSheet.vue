<script lang="ts" setup>
/**
 * Model picker - a bottom sheet listing every route OmniRoute exposes.
 *
 * OmniRoute publishes several hundred models, so the list is rendered with a
 * `ListView` (which recycles its rows) and can be filtered by a search field.
 * Each row carries the accent colour of its provider, which makes the list
 * scannable by colour.
 */
import { computed, ref } from 'vue';
import type { OmniRouteModel } from '../services/omniroute';
import { providerOf } from '../utils/accent';

const props = defineProps<{
  models: OmniRouteModel[];
  /** Currently selected model id. */
  selected: string;
  loading?: boolean;
  /** Accent colour of the active provider. */
  accent?: string;
}>();

const emit = defineEmits<{
  close: [];
  select: [model: OmniRouteModel];
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
function providerOfModel(model: OmniRouteModel): string {
  return providerOf(model.id);
}
</script>

<template>
  <GridLayout class="sheet-backdrop" @tap="emit('close')">
    <GridLayout class="sheet" rows="auto, auto, auto, *" @tap="() => {}">
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
        <Label col="1" text="×" class="sheet-close" @tap="emit('close')" />
      </GridLayout>

      <!-- Search -->
      <GridLayout row="2" columns="auto, *" class="sheet-search">
        <Label col="0" text="⌕" class="sheet-search-icon" />
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
          <GridLayout
            columns="auto, *, auto"
            class="model-row"
            :class="{ 'model-row--active': model.id === selected }"
            @tap="emit('select', model)"
          >
            <Label col="0" text="●" class="model-dot" :color="accent ?? '#2F55F5'" />
            <StackLayout col="1">
              <Label :text="providerOfModel(model)" class="model-provider" />
              <Label :text="model.id" textWrap="true" class="model-id" />
            </StackLayout>
            <Label
              col="2"
              :text="model.id === selected ? '✓' : ''"
              class="model-check"
              :color="accent ?? '#2F55F5'"
            />
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
  letter-spacing: 0.6;
  margin-top: 3;
}

.sheet-close {
  color: #8d94a0;
  font-size: 24;
  width: 32;
  text-align: center;
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
  color: #9aa1ad;
  font-size: 16;
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
  padding: 10 8;
  border-radius: 10;
}

.model-row--active {
  background-color: #f4f5f8;
}

.model-dot {
  font-size: 7;
  width: 16;
  vertical-align: center;
  opacity: 0.7;
}

.model-provider {
  color: #9aa1ad;
  font-family: monospace;
  font-size: 9;
  letter-spacing: 1;
  text-transform: uppercase;
}

.model-id {
  color: #1b1e24;
  font-family: monospace;
  font-size: 13;
  margin-top: 2;
}

.model-check {
  font-size: 15;
  font-weight: 700;
  width: 24;
  text-align: right;
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
