<template>
  <GridLayout rows="auto" class="search-bar">
    <Label :text="query" class="search-query" textWrap="true" />
    <Icon :name="'close'" :size="18" class="search-action" @tap="closeSearch" />
  </GridLayout>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import Icon from './Icon.vue';

const props = defineProps<{ query: string, onClose: () => void }>();
const { query, onClose } = props;

function closeSearch() {
  onClose();
}
</script>

<style scoped>
.search-bar {
  background-color: var(--md-surface-container);
  padding: 8 12;
  border-radius: 8;
  horizontal-align: stretch;
  margin: 0 16;
}
.search-query {
  color: var(--md-on-surface);
  font-size: 14;
}
.search-action {
  margin-left: auto;
}
</style>
