<script lang="ts" setup>
/**
 * The icon set.
 *
 * Every icon is an Android vector drawable - a native resource of the app
 * (see `App_Resources/Android/src/main/res/drawable`), drawn by the platform
 * itself. It stays crisp on every screen, it follows the density of the
 * device, and it is tinted with the colour of the scheme, so the icons
 * follow the palette of the active route.
 *
 * A tone is a *role* of the Material 3 scheme, so an icon always belongs to
 * the surface it stands on: `on-surface` on a card, `on-primary` on a filled
 * button, `error` on a warning. The tone is a rule - a class of the scheme -
 * and a runtime colour is a value that cannot live in the palette.
 */
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { Color } from '@nativescript/core';
import { loadIconDrawable } from '../utils/icons';

/** The roles of the scheme an icon can be painted with. */
type IconTone =
  | 'primary'
  | 'on-primary'
  | 'primary-container'
  | 'on-primary-container'
  | 'secondary'
  | 'on-secondary-container'
  | 'tertiary'
  | 'on-surface'
  | 'on-surface-variant'
  | 'outline'
  | 'error'
  | 'on-error-container'
  | 'inverse'
  | 'live'
  | 'offline';

const props = withDefaults(
  defineProps<{
    /** Name of the icon, see `src/utils/icons.ts` for the set. */
    name: string;
    /** Size of the glyph in device independent pixels. */
    size?: number;
    /**
     * A concrete colour. Wins over the tone, and is what a runtime colour
     * needs - a value that cannot live in the palette of the theme.
     */
    color?: string;
    /**
     * A role of the Material 3 scheme. The glyph is then painted with the
     * colour the palette gives it, so it follows the light or the dark theme
     * and the route that is on screen.
     */
    tone?: IconTone;
  }>(),
  {
    size: 24,
    tone: 'on-surface',
  },
);

const imageRef = ref<any>(null);

/**
 * The native view of the icon.
 *
 * A parent can hold on to it and animate it: the live dot of the app bar
 * pulses, and the three dots of the typing indicator hop.
 */
defineExpose({
  get nativeView() {
    return imageRef.value?.nativeView;
  },
});

/**
 * The Android widget behind the icon.
 *
 * The drawable and its colour filter live on the widget, so the icon reaches
 * for it: the view of the framework draws the shape of the platform, and the
 * tint is a filter on it.
 */
function widget(): any {
  return imageRef.value?.nativeView?.nativeView;
}

/**
 * The colour of the glyph.
 *
 * A runtime colour wins over the tone. It is put on the native view by hand
 * rather than as a property: a property would shadow the tone, and the tone
 * has to keep following the theme.
 */
function colour(): Color | undefined {
  if (props.color) {
    return new Color(props.color);
  }
  return imageRef.value?.nativeView?.tintColor;
}

/** Puts the colour of the glyph on the native view. */
function paintColour() {
  const view = widget();
  if (!view) {
    return;
  }

  const tint = colour();
  if (tint) {
    view.setColorFilter(tint.android);
  } else {
    // The filter lives on the drawable, so it is cleared there.
    view.getDrawable()?.clearColorFilter();
  }
}

/**
 * Draws the icon.
 *
 * The drawable is put on the native view by hand: it keeps the vector of the
 * platform, where a source would be rasterised into a bitmap.
 */
function paint() {
  const view = widget();
  if (!view) {
    return;
  }

  const drawable = loadIconDrawable(props.name);
  if (drawable) {
    view.setImageDrawable(drawable);
  }

  /*
    The colour can land before the drawable is there - the filter would be
    lost then - so it is put on the view again with every paint.
  */
  paintColour();
}

onMounted(() => {
  paint();

  /*
    The tone of the scheme is applied by the stylesheet. When it changes - the
    theme, or the route - a runtime colour has to be put on top of it again.
  */
  imageRef.value?.style?.on('tintColorChange', paintColour);
});

onUnmounted(() => {
  imageRef.value?.style?.off('tintColorChange', paintColour);
});

watch(() => props.name, paint);
watch([() => props.color, () => props.tone], paintColour, { flush: 'post' });
</script>

<template>
  <Image
    ref="imageRef"
    class="icon"
    :class="`icon--${tone}`"
    :width="size"
    :height="size"
    stretch="aspectFit"
  />
</template>

<style scoped>
.icon {
  vertical-align: center;
  horizontal-align: center;
}

/*
  The tones. A tone is a role of the scheme in `src/app.css`, so the glyph
  follows the light or the dark theme - and the palette of the active route.
  The rules carry the class of the icon itself as well, so they win over the
  default of `.icon` whatever the order of the style sheet is.
*/
.icon.icon--primary {
  tint-color: var(--md-primary);
}

.icon.icon--on-primary {
  tint-color: var(--md-on-primary);
}

.icon.icon--primary-container {
  tint-color: var(--md-primary-container);
}

.icon.icon--on-primary-container {
  tint-color: var(--md-on-primary-container);
}

.icon.icon--secondary {
  tint-color: var(--md-secondary);
}

.icon.icon--on-secondary-container {
  tint-color: var(--md-on-secondary-container);
}

.icon.icon--tertiary {
  tint-color: var(--md-tertiary);
}

.icon.icon--on-surface {
  tint-color: var(--md-on-surface);
}

.icon.icon--on-surface-variant {
  tint-color: var(--md-on-surface-variant);
}

.icon.icon--outline {
  tint-color: var(--md-outline);
}

.icon.icon--error {
  tint-color: var(--md-error);
}

.icon.icon--on-error-container {
  tint-color: var(--md-on-error-container);
}

.icon.icon--inverse {
  tint-color: var(--md-inverse-on-surface);
}

.icon.icon--live {
  tint-color: var(--md-live);
}

.icon.icon--offline {
  tint-color: var(--md-error);
}
</style>
