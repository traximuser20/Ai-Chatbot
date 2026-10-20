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
 * `var(--app-*)` by walking up the view tree.
 */
import { useThemeStore } from './stores/theme';
import Home from './components/Home.vue';

const theme = useThemeStore();
</script>

<template>
  <Frame :class="theme.themeClass">
    <Home />
  </Frame>
</template>
