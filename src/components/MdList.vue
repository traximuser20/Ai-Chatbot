<script lang="ts" setup>
/**
 * A list of a Markdown reply.
 *
 * The component is recursive: a list that is indented under an item is
 * rendered as a child of that item, so "1. a" / "   - b" reads the way it
 * is written.
 *
 * It is a component of its own for a reason - a nested list has to be
 * rendered inside the text column of its parent item, which a flat list of
 * blocks cannot express.
 */
import { computed } from 'vue';
import type { ListBlock } from '../utils/markdown';

const props = withDefaults(
  defineProps<{
    /** The list to render. */
    list: ListBlock;
    /** Accent colour of the markers. */
    accent?: string;
    /** Body text multiplier from the user's text-size setting. */
    scale?: number;
  }>(),
  {
    accent: '#2F55F5',
    scale: 1,
  },
);

/** The size of the body text. */
const bodySize = computed(() => Math.round(15 * props.scale));

/** The marker of an item: a number for an ordered list, a bullet otherwise. */
function marker(index: number): string {
  return props.list.ordered ? `${index + 1}.` : '•';
}
</script>

<template>
  <StackLayout class="md-list">
    <GridLayout
      v-for="(item, index) in list.items"
      :key="index"
      columns="auto, *"
      class="md-list-row"
    >
      <Label
        col="0"
        :text="marker(index)"
        class="md-list-marker"
        :color="accent"
        :fontSize="bodySize"
      />
      <StackLayout col="1">
        <Label textWrap="true" class="md-list-text" :fontSize="bodySize">
          <FormattedString>
            <Span
              v-for="(token, tokenIndex) in item.tokens"
              :key="tokenIndex"
              :text="token.text"
              :fontWeight="token.bold ? 'bold' : 'normal'"
              :fontStyle="token.italic ? 'italic' : 'normal'"
              :textDecoration="token.strike ? 'line-through' : 'none'"
              :fontFamily="token.code ? 'monospace' : undefined"
              :color="token.code ? accent : undefined"
            />
          </FormattedString>
        </Label>

        <!-- The lists that are indented under this item. -->
        <StackLayout
          v-for="(child, childIndex) in item.children"
          :key="childIndex"
          class="md-list-nested"
        >
          <MdList :list="child" :accent="accent" :scale="scale" />
        </StackLayout>
      </StackLayout>
    </GridLayout>
  </StackLayout>
</template>

<style scoped>
.md-list {
  margin-bottom: 10;
}

.md-list-row {
  margin-bottom: 4;
}

.md-list-marker {
  font-family: monospace;
  font-weight: 700;
  width: 22;
  text-align: left;
  padding-right: 2;
  /*
    Align the marker with the FIRST line of the item, not with the centre of
    the (possibly wrapped) text block.
  */
  vertical-align: top;
}

.md-list-text {
  color: var(--app-ink);
}

/* A list that is indented under an item. */
.md-list-nested {
  margin-left: 10;
}
</style>
