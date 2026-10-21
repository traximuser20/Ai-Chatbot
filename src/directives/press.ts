/**
 * `v-press` - tactile feedback for anything the finger can touch.
 *
 * The view contracts while it is held and springs back when it is released.
 * The touch handler always returns `false` so the event keeps propagating
 * and the `tap` still fires.
 *
 *     <Label v-press text="Send" @tap="send" />
 */
import type { DirectiveBinding, ObjectDirective } from 'vue';
import { TouchAction } from '@nativescript/core/ui/gestures';
import { pressIn, pressOut } from '../utils/motion';

function nativeViewOf(el: any) {
  return el?.nativeView ?? el;
}

export const press: ObjectDirective = {
  mounted(el: any, binding: DirectiveBinding) {
    const view = nativeViewOf(el);
    if (!view || typeof view.on !== 'function') {
      return;
    }

    const scale = Number(binding.value) || 0.93;
    let held = false;

    /*
      The action of a touch event is one of the strings of `TouchAction`
      (`down`, `up`, `move`, `cancel`) - not the integer of the motion event
      of Android, so it is compared with the constants of the enum.
    */
    const onTouch = (args: any) => {
      const action = args?.action;
      if (action === TouchAction.down) {
        held = true;
        pressIn(view, scale);
      } else if (action === TouchAction.up || action === TouchAction.cancel) {
        if (held) {
          held = false;
          pressOut(view, scale);
        }
      }
      // Never consume the event: the tap has to reach the control.
      return false;
    };

    view.on('touch', onTouch);
    (view as any).__pressOff = () => view.off('touch', onTouch);
  },
  unmounted(el: any) {
    const view = nativeViewOf(el);
    if (view && typeof view.off === 'function' && (view as any).__pressOff) {
      (view as any).__pressOff();
    }
  },
};

export default press;
