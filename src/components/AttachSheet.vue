<script lang="ts" setup>
/**
 * The attach sheet: where an attachment comes from.
 *
 * A small modal bottom sheet with the three ways a file can reach a message
 * - the photo library, the camera, and any document on the device. The
 * caller does the picking; this sheet only says which one was chosen.
 */
import { onMounted, ref } from 'vue';
import Icon from './Icon.vue';

const emit = defineEmits<{
  close: [];
  /** Which source was picked. */
  pick: [source: 'gallery' | 'camera' | 'document'];
}>();

/** The sheet, so it can slide up into place. */
const sheetRef = ref<any>(null);

onMounted(() => {
  const sheet = sheetRef.value?.nativeView;
  if (sheet) {
    sheet.translateY = 200;
    sheet.animate({ translate: { x: 0, y: 0 }, duration: 280, curve: 'easeOut' });
  }
});

const sources: { source: 'gallery' | 'camera' | 'document'; icon: string; title: string; sub: string }[] = [
  { source: 'gallery', icon: 'image', title: 'Photos', sub: 'Pick an image from your gallery' },
  { source: 'camera', icon: 'camera', title: 'Camera', sub: 'Take a photo right now' },
  { source: 'document', icon: 'file', title: 'Document', sub: 'Attach a file of any kind' },
];
</script>

<template>
  <GridLayout class="attach-backdrop" @tap="emit('close')">
    <GridLayout ref="sheetRef" class="attach-sheet" rows="auto, auto" @tap="() => {}">
      <Label row="0" class="attach-handle" />

      <StackLayout row="1">
        <GridLayout
          v-for="(item, index) in sources"
          :key="item.source"
          columns="auto, *"
          class="attach-row"
          :class="{ 'attach-row--first': index === 0 }"
          v-press
          @tap="emit('pick', item.source)"
        >
          <Icon col="0" :name="item.icon" :size="22" tone="primary" class="attach-icon" />
          <StackLayout col="1">
            <Label :text="item.title" class="attach-title" />
            <Label :text="item.sub" class="attach-sub" />
          </StackLayout>
        </GridLayout>
      </StackLayout>
    </GridLayout>
  </GridLayout>
</template>

<style scoped>
.attach-backdrop {
  background-color: var(--md-scrim);
  horizontal-align: stretch;
  vertical-align: stretch;
}

.attach-sheet {
  background-color: var(--md-surface-container-low);
  border-top-left-radius: 28;
  border-top-right-radius: 28;
  horizontal-align: stretch;
  vertical-align: bottom;
  padding: 0 8 20 8;
}

.attach-handle {
  width: 32;
  height: 4;
  border-radius: 2;
  background-color: var(--md-on-surface-variant);
  opacity: 0.4;
  margin-top: 12;
  margin-bottom: 6;
  horizontal-align: center;
}

.attach-row {
  padding: 16;
  border-radius: 16;
  width: 100%;
}

.attach-row--first {
  background-color: transparent;
}

/*
  The icon sizes itself through its prop, so the slot it stands in is kept
  with margins: the glyph stays in the middle of it, and the text keeps the
  place it had.
*/
.attach-icon {
  margin-left: 9;
  margin-right: 23;
  vertical-align: center;
}

.attach-title {
  color: var(--md-on-surface);
  font-size: 16;
  font-weight: 500;
}

.attach-sub {
  color: var(--md-on-surface-variant);
  font-size: 12;
  margin-top: 2;
}
</style>
