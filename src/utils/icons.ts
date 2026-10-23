import { ImageSource, Screen, Utils } from '@nativescript/core';

/**
 * The icon set.
 *
 * Every icon of the interface is an Android vector drawable: a native
 * resource of the app, drawn by the platform itself. It follows the density
 * of the screen, and it is painted with the colour of the scheme - so the
 * icons follow the palette of the active route.
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
  copy: 'ic_copy',
  edit: 'ic_edit',
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
  wave: 'ic_wave',
};

/**
 * How big a glyph is drawn, in device independent pixels.
 *
 * The largest icon of the interface is 34 (the microphone of the voice
 * sheet), so every glyph is rendered a little above that: the picture is
 * always at least as fine as the view that shows it, whatever the screen.
 */
const GLYPH_DIP = 40;

/** The picture of an icon, drawn once and shared by every view that shows it. */
const pictures = new Map<string, ImageSource>();

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
 * The picture of an icon.
 *
 * The vector of the platform is drawn into a picture at the resolution of
 * the screen, and the picture is handed to the image view of the framework -
 * the same way the pictures of the app are handed to it. The framework then
 * sizes it, stretches it and tints it on its own.
 */
export function iconPicture(name: string): ImageSource | undefined {
  const key = drawableOf(name);
  const drawn = pictures.get(key);
  if (drawn) {
    return drawn;
  }

  if (!Utils.android) {
    return undefined;
  }

  try {
    const resources = Utils.android.getResources();
    const identifier = resources.getIdentifier(
      key,
      'drawable',
      Utils.android.getPackageName(),
    );

    if (!identifier) {
      console.error(`The drawable of the icon "${name}" was not found.`);
      return undefined;
    }

    const context = Utils.android.getApplicationContext();
    const drawable = resources.getDrawable(identifier, context.getTheme());

    const pixels = Math.max(1, Math.round(GLYPH_DIP * Screen.mainScreen.scale));
    const bitmap = android.graphics.Bitmap.createBitmap(
      pixels,
      pixels,
      android.graphics.Bitmap.Config.ARGB_8888,
    );
    const canvas = new android.graphics.Canvas(bitmap);
    drawable.setBounds(0, 0, pixels, pixels);
    drawable.draw(canvas);

    const picture = new ImageSource(bitmap);
    pictures.set(key, picture);
    return picture;
  } catch (err) {
    console.error(`Could not draw the icon "${name}":`, err);
    return undefined;
  }
}
