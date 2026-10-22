import { Utils } from '@nativescript/core';

/**
 * The icon set.
 *
 * Every icon of the interface is an Android vector drawable: a native
 * resource of the app, drawn by the platform itself. It stays crisp on every
 * screen, it follows the density of the device, and it is tinted with the
 * colour of the scheme - so the icons follow the palette of the active route.
 *
 * The drawables live in `App_Resources/Android/src/main/res/drawable` and are
 * built from the Material Icons by `design/icons/build_drawables.py`.
 */

/** The drawable that draws each icon of the interface. */
const DRAWABLES: Record<string, string> = {
  menu: 'ic_menu',
  'chevron-down': 'ic_chevron_down',
  'chevron-left': 'ic_chevron_left',
  'arrow-up': 'ic_arrow_up',
  stop: 'ic_stop',
  plus: 'ic_plus',
  close: 'ic_close',
  search: 'ic_search',
  sliders: 'ic_sliders',
  user: 'ic_user',
  dot: 'ic_dot',
  check: 'ic_check',
  dots: 'ic_dots',
  trash: 'ic_trash',
  retry: 'ic_retry',
  warning: 'ic_warning',
  plane: 'ic_plane',
  info: 'ic_info',
  microphone: 'ic_microphone',
  camera: 'ic_camera',
  paperclip: 'ic_paperclip',
  image: 'ic_image',
  file: 'ic_file',
  volume: 'ic_volume',
  play: 'ic_play',
};

/**
 * The name of the drawable of an icon.
 *
 * An unknown name falls back to the information icon, so a typo shows a
 * glyph instead of an empty box.
 */
export function drawableOf(name: string): string {
  return DRAWABLES[name] ?? DRAWABLES['info'];
}

/**
 * Loads the drawable of an icon from the resources of the app.
 *
 * The drawable is loaded again for every icon: the resources hand out the
 * same shape over and over, and the colour of one icon must not reach the
 * others. `mutate` gives the drawable a state of its own, which is what
 * keeps the colours apart.
 */
export function loadIconDrawable(name: string): android.graphics.drawable.Drawable | undefined {
  if (!Utils.android) {
    return undefined;
  }

  try {
    const resources = Utils.android.getResources();
    const identifier = resources.getIdentifier(
      drawableOf(name),
      'drawable',
      Utils.android.getPackageName(),
    );

    if (!identifier) {
      console.error(`The drawable of the icon "${name}" was not found.`);
      return undefined;
    }

    const context = Utils.android.getApplicationContext();
    const drawable = resources.getDrawable(identifier, context.getTheme());
    return typeof drawable?.mutate === 'function' ? drawable.mutate() : drawable;
  } catch (err) {
    console.error(`Could not load the drawable of the icon "${name}":`, err);
    return undefined;
  }
}
