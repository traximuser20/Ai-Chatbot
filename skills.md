---
name: nativescript-vue-omni-ai
description: >-
  Workflows, runbooks, and debugging procedures for the Omni Ai project - a
  NativeScript-Vue 3 mobile client for an OpenAI compatible model gateway,
  running on the Docker Android emulator, with a themed interface, a Markdown
  renderer, a navigation drawer and an icon font.
---

# Omni Ai - Runbook

Step by step procedures for developing, previewing, running and debugging the
**Omni Ai** app: a NativeScript-Vue 3 client for a local model gateway, built
with **Pinia**, a CSS token based theme and a self-hosted icon font, and
running on the **budtmo/docker-android** containerized emulator.

---

## Runbook 1: Running the containerized Android emulator & app

The project ships a Docker setup based on `budtmo/docker-android:emulator_14.0`.

### Procedure
1. Verify that hardware virtualization (KVM) is accessible on the host:
   ```bash
   ls -l /dev/kvm
   ```
   *Expected output: `/dev/kvm` exists and is accessible (`crw-rw-rw-` or `crw-rw----`).*

2. Build and launch the container:
   ```bash
   docker compose up --build
   ```
   *What happens:*
   - The container initializes noVNC, Xvfb on display `:99` (avoiding host X11 conflicts), and starts an Android 14 (API 34) emulator.
   - `entrypoint.sh` waits for `sys.boot_completed == 1`.
   - NativeScript compiles the project using Eclipse Temurin JDK 17 and deploys to the emulator.

3. Open the device:
   - **[http://localhost:6080/vnc.html](http://localhost:6080/vnc.html)** in a **private / incognito window** (see Issue 1).
   - The app boots into the launch sequence and then into the chat.

4. Connect to ADB from the host:
   ```bash
   adb connect localhost:5555
   adb devices
   ```

---

## Runbook 2: The development loop

### A. Change a file, see it on the device
The workspace is mounted into `/home/androidusr/app`, and the webpack watcher of
`ns run android` is running.

1. Edit anything in `src/` (`.vue`, `.ts`, `.css`).
2. Save. The bundler recompiles and the device reloads.
3. Look at the device. If the screen did not change, the transfer did not
   arrive - see **B**.

> **Do not run `ns run android` manually** while the entrypoint's instance is
> running. Two concurrent runs race on the Gradle temp plugin and fail with
> `spawn .../tempPlugin/core/gradlew ENOENT` or
> `Error executing Static Binding Generator: File already exists`.

### B. The device runs an old bundle (the LiveSync transfer is unreliable here)
The transfer reports success while the file on the device keeps its old
content, and the hot update chunks it leaves behind are re-applied on top of
the new bundle - which silently reverts the newest code.

**Check what the device actually runs:**
```bash
docker exec nativescript-vue-android sh -c 'md5sum files/app/bundle.js'
md5sum platforms/android/app/src/main/assets/app/bundle.js
```
*The two sums have to be the same. If they are not, the device is stale.*

**Push the build by hand:**
```bash
adb push platforms/android/app/src/main/assets/app/bundle.js /data/local/tmp/
adb push platforms/android/app/src/main/assets/app/runtime.js /data/local/tmp/
adb shell "run-as org.nativescript.omniai sh -c \
  'cat /data/local/tmp/bundle.js  > files/app/bundle.js; \
   cat /data/local/tmp/runtime.js > files/app/runtime.js; \
   rm -f files/app/*.hot-update.*'"
adb shell am force-stop org.nativescript.omniai
adb shell am start  org.nativescript.omniai/com.tns.NativeScriptActivity
```

### C. Rebuilds that need the native side
A change to `package.json`, `App_Resources/Android/`, `nativescript.config.ts`
or `src/fonts/` needs a native rebuild:
```bash
docker exec -it nativescript-vue-android ns run android
```
or restart the container with `docker compose up`.

### D. Check the change before it reaches the device
```bash
npx tsc --noEmit -p tsconfig.json   # the TypeScript
node tools/check-components.mjs      # every single file component
```
`tsc` does not read a template. A component that fails to compile renders
**nothing at all**, without an error in the log - the bundler is the only
place that complains.

---

## Runbook 3: Talking to the gateway

The app is a client of a local gateway that speaks the OpenAI API.

### The address
From inside the emulator, `localhost` is the emulator. The gateway is reached
through the alias of the host:
```typescript
const HOST = Application.android ? '10.0.2.2' : '127.0.0.1';
const BASE_URL = `http://${HOST}:20128`;
```
On a physical device, use the LAN address of the host instead.

### The pieces
- `src/services/omni-ai.ts` - the client. `loadModels()` lists the routes,
  `sendChat()` sends a conversation and accepts an `AbortSignal` so the
  composer can stop a request that is on its way.
- The key travels in the `Authorization` header. It is the local developer
  key of the gateway and lives in that file.
- `android:usesCleartextTraffic="true"` in `App_Resources/Android/src/main/AndroidManifest.xml`
  is what allows the plain HTTP request during development.

### The route is the accent
The prefix of a model id (`auto/`, `aihorde/`, `dva/`, …) is the provider, and
the provider is the colour of the interface. `src/utils/accent.ts` holds the
map; a provider that is not in it gets a stable colour derived from its name.
**Every accent coloured surface has to be bound to it** - a hard coded colour
does not follow the route.

---

## Runbook 4: Writing a component

### The shape of a component
```vue
<script lang="ts" setup>
import { ref } from 'vue';
import { useChatStore } from '../stores/chat';

const chatStore = useChatStore();
</script>

<template>
  <Page>
    <GridLayout rows="auto, *">
      <!-- native elements only -->
    </GridLayout>
  </Page>
</template>
```

### The rules that bite
- **No web elements.** `<div>`, `<span>`, `<input>`, `<button>` and `<View>`
  do not exist. Use `Label`, `TextField`, `Button` and `ContentView`.
- **A `GridLayout` needs its rows and columns**, and every child needs its
  `row` and `col`.
- **A `v-for` in a `GridLayout` puts every child in column 0.** Use a
  `StackLayout orientation="horizontal"` or a `WrapLayout` instead.
- **A `v-for` on a `<template>` inside a native view** puts the element of the
  second round inside the element of the first one. Put the `v-for` on a real
  element.
- **Multi line text needs `textWrap="true"`.**
- **`@tap`, not `@click`.**
- **The palette is a set of tokens**: `var(--app-surface)`,
  `var(--app-ink)`, `var(--app-border)`, … A hard coded hex does not follow
  the theme and is a bug.
- **A property beats a rule.** If a surface has to follow the theme, paint it
  with a rule. Only a runtime value (the accent) belongs in a property.
- **Icons come from `Icon.vue`**: `<Icon name="search" :size="16" tone="muted" />`
  or `<Icon name="search" :size="16" :color="accent" />`.
- **Anything tappable gets `v-press`**, which gives it the tactile response.
- **Anything that animates goes through `src/utils/motion.ts`** - the CSS
  keyframes of a scoped style block do not run.

---

## Runbook 5: The design assets

Both sets of assets are generated, so the sources and the runtime files can
never drift apart.

```bash
python3 design/logo/build-assets.py    # the mark, the launch assets, the icons
python3 design/icons/build_drawables.py # the icon set (the vector drawables)
```

- `design/logo/` holds the SVG sources of the mark - a square rotated 45
  degrees, filled with the brand spectrum and crossed by a single white beam.
  The build writes the runtime PNGs into `src/assets/img/` and the platform
  icons into `App_Resources/`.
- `design/icons/build_drawables.py` cuts the Material Icons down to the
  twenty-five shapes the app uses and writes them as Android vector drawables
  into `App_Resources/Android/src/main/res/drawable/`. A change to the set of
  icons means a change to that file **and a rebuild of the app** - the
  drawables are native resources, so they need a native rebuild. A shape that
  is not in the set renders as the information icon.

---

## Runbook 6: Troubleshooting & Diagnostic Matrix

### Issue 1: `noVNC encountered an error: Cannot read properties of undefined (reading 'M_ID')`
- **Cause**: A Chrome VPN or proxy extension (such as Urban VPN `eppiocemhmnlbhjplcgkofciiegomcon`) injected a script into `localhost:6080` that crashed and blocked noVNC's WebSocket.
- **Fix**: Open `http://localhost:6080/vnc.html` in an **Incognito / Private tab** (where extensions are disabled), or disable the VPN extension for `localhost`.

### Issue 2: `failed to set up container networking: operation not supported (veth)`
- **Cause**: The kernel was updated on the Linux host (common in rolling releases like Arch Linux), and the running kernel cannot load `veth.ko` on demand.
- **Fix**:
  - The project's `docker-compose.yml` uses `network: host` for build and `network_mode: host` for runtime.
  - Alternatively, reboot the host machine (`sudo reboot`) to boot into the updated kernel.

### Issue 3: `Unsupported class file major version 69` during the Gradle build
- **Cause**: The base image used Java 25 (`major version 69`), which is unsupported by Gradle 8.x.
- **Fix**: The `Dockerfile` and `entrypoint.sh` are configured to install and use **Eclipse Temurin JDK 17** (`export JAVA_HOME=/usr/lib/jvm/jdk-17.0.14+7`).

### Issue 4: `EACCES: permission denied, mkdir '/home/androidusr/app/platforms/android'`
- **Cause**: The mounted host directory or volume created `platforms` with root ownership.
- **Fix**:
  ```bash
  docker exec -u 0 nativescript-vue-android chown -R androidusr:androidusr /home/androidusr/app/platforms /home/androidusr/app/node_modules
  ```

### Issue 5: `process is not defined` or `stream is not defined`
- **Cause**: A third-party web dependency imports Node.js core libraries.
- **Fix**: Open `webpack.config.js` and verify fallbacks and the `ProvidePlugin` are present:
  ```javascript
  config.resolve.fallback = {
    ...config.resolve.fallback,
    stream: false,
    crypto: false,
    os: false,
    util: false,
  };
  ```

### Issue 6: The change is on the device but nothing happened
- **Cause**: The LiveSync transfer never arrived (see Runbook 2B).
- **Fix**: Push the bundle by hand and delete the hot update chunks.

### Issue 7: The app freezes with "Omni Ai isn't responding"
- **Cause**: An endless animation was chained on a view that is not on screen. Such an animation is resolved at once, so the chain started the next frame immediately, again and again, and the thread spun at full speed.
- **Fix**: `loopAnimation()` stops when the view is not loaded and when an animation resolves faster than it could have run. The loops of a screen are stopped when it is left and when the app is suspended. Check with:
  ```bash
  adb shell top -b -n 1 -o PID,%CPU,CMDLINE | grep omniai
  ```
  *The app has to idle at 0 % CPU.*

### Issue 8: `OutOfMemoryError` / the app dies after a while
- **Cause**: The same endless animations - every frame of the chain allocated.
- **Fix**: As in Issue 7. The V8 heap of the app is 192 MB.

### Issue 9: An icon is a box, or the wrong glyph
- **Cause**: The shape is not in the icon set - the drawables are a cut down of the Material Icons with the twenty-five shapes the app uses.
- **Fix**: Add the icon to `design/icons/build_drawables.py`, rebuild the drawables (`python3 design/icons/build_drawables.py`) and rebuild the app. A change to `App_Resources/Android` needs a native rebuild.

### Issue 10: The app crashes at launch with `Cannot read properties of undefined (reading 'getResources')`
- **Cause**: The appearance of the device was asked for before the native context exists.
- **Fix**: Ask for it once the app is on screen (`src/utils/theme.ts`, `src/stores/theme.ts`).

### Issue 11: The text of a label is squashed together, or a headline is one blob
- **Cause**: `letter-spacing` is in **em** on Android, not in pixels.
- **Fix**: Use a fraction of the font size - `0.08` for a tracked out label, `-0.02` for a tight headline.

### Issue 12: A component renders nothing at all
- **Cause**: The template does not compile. `tsc` does not read a template, and the bundler is the only place that complains.
- **Fix**: Run `node tools/check-components.mjs` and read the error.

### Issue 13: A nested list is drawn in the row above it
- **Cause**: The blocks of a reply were rendered through a `<template v-for>`, which puts the element of the second round inside the element of the first one.
- **Fix**: Put the `v-for` on a real element, and let `MdList.vue` render a list that is nested in an item.

### Issue 14: The theme does not follow the device
- **Cause**: The theme class is not on the root view, or the mode is not `system`.
- **Fix**: The class belongs on the root `<Frame>` in `src/App.vue`; a token is only found by the descendants of the view that declares it.
