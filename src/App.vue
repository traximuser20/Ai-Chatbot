<script lang="ts" setup>
/**
 * Application shell.
 *
 * The `Frame` lives here so that Profile and Settings can be pushed onto the
 * navigation stack with `$navigateTo` while `Home` stays the root route.
 *
 * The frame is also the root view of the application, so it is where the
 * theme class lives: the palette is declared in `src/app.css` as custom
 * properties on `.theme-light` / `.theme-dark`, and NativeScript resolves
 * `var(--md-*)` by walking up the view tree.
 *
 * The frame is also where the *dynamic* part of the palette lives. Material
 * You derives a whole scheme from one source colour, and this app's source
 * colour is the provider that answers - so the scheme of the active route is
 * written into the CSS variables of the frame, and the whole interface
 * follows the route (see `src/utils/dynamic-color.ts`).
 */
import { onMounted, ref, watch } from 'vue';
import { useThemeStore } from './stores/theme';
import { usePaletteStore } from './stores/palette';
import { applyScheme } from './utils/dynamic-color';
import Home from './components/Home.vue';

const theme = useThemeStore();
const palette = usePaletteStore();

/** The frame - the root view, and the home of the palette. */
const frameRef = ref<any>(null);

/** Writes the palette of the route into the CSS variables of the frame. */
function paint() {
  applyScheme(palette.scheme, frameRef.value?.nativeView);
}

onMounted(paint);

// The palette follows the route and the theme, so it is repainted whenever
// one of them changes.
watch(() => palette.scheme, paint, { deep: true });
</script>

<template>
  <Frame ref="frameRef" :class="theme.themeClass">
    <Home />
  </Frame>
</template>
