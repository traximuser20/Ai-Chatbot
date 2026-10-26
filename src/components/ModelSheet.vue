<script lang="ts" setup>
/**
 * Model picker - a bottom sheet listing every route the gateway exposes.
 *
 * The gateway publishes several hundred models, so the list is rendered with a
 * `ListView` (which recycles its rows) and can be filtered by a search field.
 * The sheet follows the Material 3 recipe for a modal bottom sheet: a drag
 * handle, a title, a search field and a list of rows that are 56dp high.
 */
import { computed, ref, onMounted } from 'vue';
import type { OmniAiModel } from '../services/omni-ai';
import { providerOf } from '../utils/accent';
import Icon from './Icon.vue';
import VoiceSearch from './VoiceSearch.vue';

const props = defineProps<{
  models: OmniAiModel[];
  /** Currently selected model id. */
  selected: string;
  loading?: boolean;
}>();

const emit = defineEmits<{
  close: [];
  select: [model: OmniAiModel];
}>();

const filter = ref('');

/** Voice search: the Google shaped voice screen opens over the list. */
const showVoice = ref(false);

function onVoiceDone(text: string) {
  showVoice.value = false;
  filter.value = text;
}

/**
 * The backdrop of the sheet. It stays deaf while the voice search is open -
 * that screen owns the taps of that moment.
 */
function onBackdropTap() {
  if (showVoice.value) {
    return;
  }
  emit('close');
}

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
  <GridLayout ref="backdropRef" class="sheet-backdrop" @tap="onBackdropTap">
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
        <!-- `columns="*"` and `rows="*"` centre the glyph in the button. -->
        <GridLayout
          col="1"
          columns="*"
          rows="*"
          class="sheet-close"
          v-press
          @tap="emit('close')"
        >
          <Icon col="0" name="close" :size="20" tone="on-surface-variant" />
        </GridLayout>
      </GridLayout>

      <!-- Search: a filled text field, with the voice behind a mic button -->
      <GridLayout row="2" columns="auto, *, auto" class="sheet-search">
        <Icon col="0" name="search" :size="18" tone="on-surface-variant" class="sheet-search-icon" />
        <TextField
          col="1"
          v-model="filter"
          hint="Search models"
          class="sheet-search-field"
          returnKeyType="search"
        />
        <GridLayout
          col="2"
          columns="*"
          rows="*"
          class="sheet-search-mic"
          v-press
          @tap="showVoice = true"
        >
          <Icon col="0" name="microphone" :size="18" tone="primary" />
        </GridLayout>
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
              :size="8"
              tone="primary"
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
              columns="*"
              class="model-check"
            >
              <Icon col="0" name="check" :size="18" tone="primary" />
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

    <!-- Voice search: the words become the filter of the list. -->
    <VoiceSearch
      v-if="showVoice"
      placeholder="Search models"
      @done="onVoiceDone"
      @close="showVoice = false"
    />
  </GridLayout>
</template>

<style scoped>
.sheet-backdrop {
  background-color: var(--md-scrim);
  horizontal-align: stretch;
  vertical-align: stretch;
}

/* A modal bottom sheet: a surface that stands above the canvas. */
.sheet {
  background-color: var(--md-surface-container-low);
  border-top-left-radius: 28;
  border-top-right-radius: 28;
  horizontal-align: stretch;
  vertical-align: bottom;
  height: 74%;
  padding: 0 16 12 16;
  box-shadow: var(--md-elevation-3);
}

.sheet-handle {
  width: 32;
  height: 4;
  border-radius: 2;
  background-color: var(--md-on-surface-variant);
  opacity: 0.4;
  margin-top: 12;
  margin-bottom: 8;
  horizontal-align: center;
}

.sheet-head {
  padding-bottom: 12;
}

.sheet-title {
  color: var(--md-on-surface);
  font-size: 22;
  font-weight: 600;
}

.sheet-subtitle {
  color: var(--md-on-surface-variant);
  font-size: 12;
  margin-top: 3;
}

.sheet-close {
  width: 40;
  height: 40;
  vertical-align: center;
}

/* ---------- Search ---------- */
.sheet-search {
  background-color: var(--md-surface-container-highest);
  border-radius: 28;
  height: 48;
  padding: 0 16;
  margin-bottom: 12;
}

/* The slot of the icon is kept with margins - see `AttachSheet.vue`. */
.sheet-search-icon {
  margin-left: 3;
  margin-right: 11;
  vertical-align: center;
}

.sheet-search-field {
  background-color: transparent;
  border-width: 0;
  color: var(--md-on-surface);
  placeholder-color: var(--md-on-surface-variant);
  font-size: 15;
  vertical-align: center;
  /* The mic button sits to the right of the field. */
  margin-right: 40;
}

/* Voice search: the words become the filter. */
.sheet-search-mic {
  width: 36;
  height: 36;
  border-radius: 18;
  vertical-align: center;
  horizontal-align: center;
}

/* ---------- Rows ---------- */
.sheet-list {
  margin-bottom: 4;
}

.model-row {
  width: 100%;
  padding: 10 12;
  border-radius: 16;
}

.model-row--active {
  background-color: var(--md-secondary-container);
}

.model-dot {
  margin-right: 8;
  vertical-align: center;
}

.model-provider {
  color: var(--md-primary);
  font-size: 11;
  font-weight: 600;
  letter-spacing: 0.08;
  text-transform: uppercase;
}

.model-id {
  color: var(--md-on-surface);
  font-size: 14;
  margin-top: 2;
}

.model-row--active .model-id {
  color: var(--md-on-secondary-container);
}

.model-check {
  width: 28;
  vertical-align: center;
}

.sheet-empty {
  padding: 32 0;
}

.sheet-empty-text {
  color: var(--md-on-surface-variant);
  font-size: 14;
  text-align: center;
}
</style>
