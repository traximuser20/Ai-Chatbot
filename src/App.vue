<script lang="ts" setup>
/**
 * Application shell.
 *
 * The `Frame` lives here so that Profile and Settings can be pushed onto the
 * navigation stack with `$navigateTo` while `Home` stays the root route.
 */
import Home from './components/Home.vue';
</script>

<template>
  <Frame>
    <Home />
  </Frame>
</template>
