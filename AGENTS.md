# Omni Ai - NativeScript-Vue 3 - Agent Rules & Guidelines

Welcome to the **Omni Ai** codebase. This project is a cross-platform mobile AI chat application built with **NativeScript 9**, **NativeScript-Vue 3** and **Pinia**, running in an Android containerized emulator via **budtmo/docker-android**.

It is a *client for a gateway*: the app talks to an OpenAI compatible gateway that exposes several hundred models, and the whole interface is built around one idea - **you are always talking to a route**. The provider of the selected model is the accent colour of the app.

Whenever operating within this repository, all AI agents and assistants must strictly adhere to the following architecture rules, coding standards, and operational guidelines.

---

## 1. Codebase Architecture & Tech Stack

- **Framework**: [NativeScript 9](https://nativescript.org) with [NativeScript-Vue 3](https://github.com/nativescript-vue/nativescript-vue) (`3.1.2`).
- **Runtime & App Entry**: `src/app.ts` creates the app from `src/App.vue` and registers **Pinia** and the global `v-press` directive.
- **Shell**: `src/App.vue` holds the root `<Frame>`; the frame is the **root view** of the application, which is why it carries the theme class (see §7.1).
- **UI Components**: Vue 3 Single File Components in `src/components/`, all with `<script lang="ts" setup>`:

  | Component | What it is |
  | :--- | :--- |
  | `Home.vue` | The chat screen: app bar, conversation, composer, and the two overlays (drawer, model sheet). |
  | `ChatMessage.vue` | One message: an ink bubble for the user, Markdown for the assistant. |
  | `MarkdownView.vue` | Renders the blocks of a parsed reply. |
  | `MdList.vue` | A list of a reply. Recursive: a list indented under an item is a child of that item. |
  | `Icon.vue` | The whole icon set, drawn with the `OmniIcons` font. |
  | `SendButton.vue` | The send button of the composer: a Material 3 filled icon button with a state layer. |
  | `MdSwitch.vue` | A Material 3 switch: the native one takes its colour from the platform. |
  | `Sidebar.vue` | The drawer: new conversation, the history, profile and settings. |
  | `ModelSheet.vue` | The bottom sheet that picks the route. |
  | `Profile.vue` | The profile of the operator. |
  | `Settings.vue` | Theme, text size, timestamps, gateway. |
  | `SplashScreen.vue` | The launch sequence. |

- **State Management**: [Pinia](https://pinia.vuejs.org/) (`^4.1.0`) stores in `src/stores/`:
  - `chat.ts` - the conversations, the model, the connection state. Persisted with `ApplicationSettings`.
  - `settings.ts` - the preferences of the user. Persisted with `ApplicationSettings`.
  - `theme.ts` - the theme that is on screen (follows the device, or is pinned).
  - `palette.ts` - the Material 3 scheme of the active route (see §7.1).
- **Backend**: the gateway, over its **OpenAI-compatible HTTP API** (see §3). The client is `src/services/omni-ai.ts`.
- **Design system**:
  - `src/app.css` - the roles of the Material 3 scheme (light and dark) as CSS custom properties, and the shared classes of the design system.
  - `src/utils/material.ts` - the colour engine: the tonal palettes of Material 3 in OKLCh.
  - `src/utils/dynamic-color.ts` - writes the scheme of the route into the CSS variables of the root frame.
  - `src/utils/theme.ts` - the theme modes and the reading of a token.
  - `src/utils/accent.ts` - the provider colours and the brand tokens.
  - `src/utils/motion.ts` - the timing of every animation.
  - `src/utils/parallax.ts` - the planes of the launch sequence and the way they lean with the phone.
  - `src/utils/tilt.ts` - the reading of the gravity sensor of Android.
  - `src/utils/status-bar.ts` - the notification bar and the navigation bar of the window.
  - `src/directives/press.ts` - the tactile feedback of a tappable surface.
  - `src/fonts/OmniIcons.ttf` - the icon font, built by `design/icons/build_font.py`.
  - `design/logo/` - the mark and the launch assets, built by `design/logo/build-assets.py`.
- **Build & Bundler**: `@nativescript/webpack` (`~5.0.38`) with custom Node.js polyfill fallbacks.
- **JDK Requirement**: **Java 17 (Eclipse Temurin 17)**. Android Gradle Plugin and Gradle 8.x do not support Java 25 (which triggers `Unsupported class file major version 69`).
- **Emulation / Container**: Docker-based Android environment powered by `budtmo/docker-android:emulator_14.0`.

---

## 2. NativeScript-Vue 3 UI Rules & Conventions

### 2.1 Use NativeScript UI Elements (Never Web HTML)
NativeScript renders to native mobile widgets, **not a browser DOM**.
- **DO NOT USE**: `<div>`, `<span>`, `<p>`, `<h1>`, `<input>`, `<button>`, `<form>`, `<ul>`, `<li>`, `<View>`.
- **USE NATIVESCRIPT COMPONENTS**:
  - Layouts: `<GridLayout>`, `<StackLayout>`, `<FlexboxLayout>`, `<WrapLayout>`, `<AbsoluteLayout>`.
  - Navigation / Containers: `<Frame>`, `<Page>`, `<ActionBar>`, `<NavigationButton>`, `<ContentView>`.
  - Controls: `<Label>`, `<Button>`, `<TextField>`, `<TextView>`, `<ListView>`, `<Image>`, `<ActivityIndicator>`, `<Switch>`, `<Slider>`, `<Placeholder>` (no native view - do not use it to draw).

### 2.2 Layout & Grid Specifications
- When using `<GridLayout>`, specify `rows` and `columns` with comma-separated values (e.g., `rows="auto, *"`, `columns="*, auto"`).
- Child items inside `<GridLayout>` must explicitly specify `row="X"` and `col="Y"` (0-indexed).
- Always set `textWrap="true"` on `<Label>` elements intended for multi-line content, otherwise text will truncate.

### 2.3 Event Handling
- Use `@tap="handler"` instead of `@click` for user interactions (buttons, labels, cards).
- Use `@submit="handler"` or `@textChange="handler"` for text inputs.
- For back navigation, use `$navigateBack` from `nativescript-vue`; to push a screen, `$navigateTo(Component, { transition: { name: 'slide', duration: 260 } })`.

### 2.4 Styling Rules
- The palette is a set of **tokens**, not a second set of rules. `src/app.css` declares the light and the dark values of every role of the Material 3 scheme, and every component uses `var(--md-*)`. **A hardcoded hex in a component is a bug** - it does not follow the theme, and it does not follow the route.
- A **property** (`:backgroundColor`, `:color`) always wins over a rule. A surface that has to follow the theme is painted with a rule. A runtime colour - the colour of an inline code token inside a `Span`, for instance - is a property, because a `Span` cannot be painted by a rule.
- `Icon.vue` takes a `tone` - a **role** of the scheme, such as `primary` or `on-surface-variant` - or a `color` for a runtime value. The tone is a rule, the colour is a property.
- The shape of a surface is a literal number (4, 8, 12, 16, 28) taken from the Material 3 shape scale. The corners are not a token.

---

## 3. Network & Backend Connectivity Rules

### 3.1 The gateway (the backend)
- The app talks to the gateway through its **OpenAI-compatible HTTP API** (`src/services/omni-ai.ts`):
  - `GET  /v1/models` - list of available models (570+ on a typical install).
  - `POST /v1/chat/completions` - chat completion, standard OpenAI request/response shape.
- **The gateway does NOT speak Socket.IO.** An earlier version of this app used `socket.io-client`; that backend no longer exists and the dependency has been removed.
- The gateway also exposes a **Responses API over WebSocket** and a management dashboard on the same port. **Do not use the WebSocket endpoint from the app**: NativeScript 9 has no global `WebSocket` implementation (`globalThis.WebSocket` is `undefined`).
- **Auth**: requests carry `Authorization: Bearer <OMNIROUTE_API_KEY>`. The key is read from the `OMNIROUTE_API_KEY` environment variable on the machine running the gateway and is hard-coded in `src/services/omni-ai.ts` (it is a local developer gateway key).

### 3.2 Android Emulator Host Loopback (`10.0.2.2`)
- **CRITICAL**: From within an Android emulator, `localhost` and `127.0.0.1` refer to the emulator's own internal loopback interface, **not** the developer's computer.
- The gateway listens on `127.0.0.1:20128` of the host, so the app must use:
  ```typescript
  const HOST = Application.android ? '10.0.2.2' : '127.0.0.1';
  const BASE_URL = `http://${HOST}:20128`;
  ```
- Note: `10.0.2.2` is the **emulator's** alias for the host. It is *not* reachable from the container itself, and not from the host.
- Android network security configuration in `App_Resources/Android/src/main/AndroidManifest.xml` must have `android:usesCleartextTraffic="true"` to permit local HTTP traffic during development.

### 3.3 Streaming
- The gateway supports SSE streaming (`"stream": true`), but NativeScript's `XMLHttpRequest` (which backs `fetch`) **buffers the whole response** - there is no incremental `onprogress` delivery. The app therefore requests `stream: false` and renders the complete answer at once, with the typing indicator shown while waiting.

### 3.4 Cancelling a request
- `fetch` in NativeScript honours an `AbortSignal`. The composer keeps the `AbortController` of the request in flight, and the send button turns into a stop button while the answer is on its way. A cancelled request is **not** an error.

### 3.5 A physical phone
- The gateway listens on `127.0.0.1:20128` of the machine that runs it, so a phone cannot reach it on its own. The port is **forwarded to the host** instead:
  ```bash
  adb -s <phone> reverse tcp:20128 tcp:20128
  ```
- With that tunnel in place the phone reaches the gateway on `127.0.0.1:20128` - the same address the app uses on a phone. `src/utils/device.ts` tells an emulator from a phone: the emulator sees the host behind `10.0.2.2`, a phone sees it through the forwarded port.
- The address can also be set **by hand** in the settings screen, for a gateway that runs on another machine - the LAN address of that machine, for instance. The choice is stored with the rest of the settings.

---

## 4. Webpack & Node.js Polyfill Rules

NativeScript runs V8 on Android without Node.js standard libraries. Any third-party npm package that attempts to import core Node modules (`os`, `util`, `stream`, `fs`, `tty`, `process`) will fail at runtime unless shinned:
1. When adding packages, maintain the `config.resolve.fallback` dictionary in `webpack.config.js`.
2. Do not remove the `ProvidePlugin` configuration for `process` in `webpack.config.js`.
3. If a package requires native node APIs, verify if a NativeScript plugin exists before attempting to bundle it.
4. **Always spread the existing fallback** (`...(config.resolve.fallback || {})`) so the entries `@nativescript/webpack` already configured (e.g. the `module` polyfill) are not dropped.

---

## 5. Docker, Emulator & Host Environment Guidelines

### 5.1 Host Networking & X11 Display Allocation
- `docker-compose.yml` uses `network_mode: host` to eliminate Linux kernel `veth` module dependency issues.
- **Display Conflict Prevention**: In host network mode, the container shares abstract UNIX domain sockets with the host. To prevent collisions with the developer's host X11 desktop server on `:0`, the container is configured with `DISPLAY=:99`.

### 5.2 Browser noVNC Access & Extension Interference
- The live Android emulator GUI is accessible via browser at `http://localhost:6080/vnc.html`.
- **Known Issue**: Browser extensions that intercept network or proxy traffic (e.g., Urban VPN `eppiocemhmnlbhjplcgkofciiegomcon`) inject scripts that crash with `Cannot read properties of undefined (reading 'M_ID')`. Always advise users to access noVNC via **Incognito mode** or with VPN extensions disabled for `localhost`.

### 5.3 Permissions and Volume Mounts
- The container runs as non-root user `androidusr`.
- Avoid overwriting `/home/androidusr/app/node_modules` or `/home/androidusr/app/platforms` with root-owned or host-architecture binaries.
- Ensure `platforms` and `node_modules` retain write permissions for `androidusr`.
- The Docker volume for `platforms/` is created root-owned, which makes the NativeScript CLI fail with `EACCES: permission denied, mkdir '/home/androidusr/app/platforms/android'`. The `Dockerfile` pre-creates the directory with `androidusr` ownership, and `entrypoint.sh` calls `fix_project_permissions()` on every start.

### 5.4 The `root` User Is Deleted by the Base Image
- The `budtmo/docker-android` emulator bootstrap runs `sudo sed -i '1d' /etc/passwd`, removing the `root` account.
- On the **next** container start `sudo` can no longer resolve it (`sudo: unknown user root`), so `sudo chown 1300:1301 /dev/kvm` fails and the emulator never boots (`CalledProcessError` in `logs/device.stdout.log`).
- **Fix**: `entrypoint.sh` calls `restore_root_user()` **before** starting the emulator, re-inserting `root` as the **first** line of `/etc/passwd` so the base image always deletes that temporary entry instead of a real system account. The `Dockerfile` gives `/etc/passwd` group-`androidusr` write access (`chown root:androidusr` + `chmod 664`) so the in-place rewrite works.
- **Ordering matters**: every privileged repair (`restore_root_user`, `fix_project_permissions`) must run *before* the emulator starts, because the emulator strips `root` and breaks `sudo` afterwards.

### 5.5 JDK 17 Is Required
- Gradle 8.x rejects the Java 25 that ships in the base image (`Unsupported class file major version 69`).
- The `Dockerfile` installs Eclipse Temurin JDK 17 and sets `JAVA_HOME`. `entrypoint.sh` also auto-detects a JDK 17 via `configure_java()`.

### 5.6 Android SDK 35 Is Required
- `@nativescript/android` defaults to `NS_DEFAULT_COMPILE_SDK_VERSION=35` and `NS_DEFAULT_BUILD_TOOLS_VERSION=35.0.0`.
- `App_Resources/Android/app.gradle` must match (`compileSdkVersion 35`, `buildToolsVersion "35.0.0"`, `targetSdkVersion 35`), and the `Dockerfile` must install `platforms;android-35` + `build-tools;35.0.0`.
- API 35 (revision 2) additionally requires the `android-sdk-license` hash `d56f5187479451eabf01fb78af6dfcb131a6481e`; without it Gradle aborts with `Failed to install the following SDK components: platforms;android-35`.

---

## 6. Development & Code Preview Workflow

### 6.1 Instant LiveSync / HMR (Code & UI Changes)
- When running `docker compose up`, the workspace is mounted into `/home/androidusr/app`.
- NativeScript's Webpack watcher and Hot Module Replacement (HMR) are active.
- Editing and saving any file in `src/` (`.vue`, `.ts`, `.css`) automatically triggers HMR and live updates the app on the running emulator. No restart is needed.
- **Do not run `ns run android` manually while the entrypoint's instance is running.** Two concurrent runs race on the Gradle temp plugin and fail with `spawn .../tempPlugin/core/gradlew ENOENT` or `Error executing Static Binding Generator: File already exists`.

### 6.2 The LiveSync transfer is not reliable in this container
The transfer of `ns run android` reports success but the file on the device keeps the old content, and the hot update chunks it leaves behind are re-applied on top of the fresh bundle - which silently reverts the newest code. Two things follow from it:

- **Verify what the device actually runs** before chasing a bug:
  ```bash
  docker exec nativescript-vue-android sh -c \
    'md5sum files/app/bundle.js' # against the build output
  ```
- **To push a build by hand**, copy the bundle into the app data directory and delete the stale chunks:
  ```bash
  adb push platforms/android/app/src/main/assets/app/bundle.js /data/local/tmp/
  adb shell "run-as org.nativescript.omniai sh -c \
    'cat /data/local/tmp/bundle.js > files/app/bundle.js; rm -f files/app/*.hot-update.*'"
  adb shell am force-stop org.nativescript.omniai
  ```

### 6.3 Native & Configuration Rebuilds
- Modifications to `package.json`, `App_Resources/Android/`, `nativescript.config.ts` or `src/fonts/` require a native rebuild.
- Trigger rebuilds via:
  ```bash
  docker exec -it nativescript-vue-android ns run android
  ```
  or restart the container with `docker compose up`.

### 6.4 Check a change before it reaches the device
- `npx tsc --noEmit -p tsconfig.json` checks the TypeScript.
- `tsc` does **not** check a template. A broken template only shows up in the bundler, and a component that fails to compile renders nothing at all - silently. Compile the single file components before shipping a change:
  ```bash
  node -e "const {parse,compileTemplate,compileScript}=require('@vue/compiler-sfc');/* … */"
  ```
  (see §9 for a ready made script).

### 6.5 On a physical phone (wireless debugging)
The phone is reached over WiFi, so no cable is needed. The pairing and the debugging use **two different ports** - the code of the "Pair device with Wi-Fi pairing code" dialog pairs, and the port of the "Wireless debugging" screen connects.

```bash
adb pair <ip>:<pairing-port> <code>     # once
adb mdns services                        # -> <name>  _adb-tls-connect._tcp  <ip>:<port>
adb connect <ip>:<debugging-port>
```

The app is then built for the phone instead of the emulator:

```bash
ns run android --device <ip>:<port>
```

Three things are worth knowing:

1. **MIUI refuses an install from the shell** until "Install via USB" (开发者选项 → *Install via USB*) is on. Without it every install fails with `INSTALL_FAILED_USER_RESTRICTED`, and the phone keeps the bundle of the last APK. The same setting takes `INJECT_EVENTS` away from the shell, so `adb shell input tap` and `input text` do not work; `monkey` does, with a script file.
2. **A change in the JavaScript does not rebuild the APK.** The CLI pushes the bundle to the device with LiveSync instead. When the install failed, that push never happened - check what the device really runs before chasing a bug:
   ```bash
   adb -s <phone> shell "run-as org.nativescript.omniai md5sum files/app/bundle.js"
   ```
   The hot-update chunks that a failed run leaves behind are re-applied on top of a fresh bundle and silently revert the newest code - they are removed with the manual push of §6.2.
3. **The build must not run twice at the same time.** The entrypoint of the container already builds for the emulator, and a second `ns run` in the same project races with it on the Gradle temp plugin. Stop the container first, then build for the phone:
   ```bash
   docker compose stop
   ```
   The emulator container and the phone build also share the `platforms/` volume, so only one of them may watch the sources at a time.

---

## 7. NativeScript CSS Caveats

NativeScript's CSS engine is **not** a browser engine. The following Tailwind/CSS features silently fail:

| Feature | Symptom | Workaround |
| :--- | :--- | :--- |
| `justify-self-*` | User and AI bubbles both left-aligned | Use a `GridLayout` with `columns="*, auto"` (trailing `auto` column hugs the bubble, leading `*` pushes it right) |
| `line-height: <n>` | Mapped to `TextView.setLineSpacing(extra, 1)` — it **adds** to the natural line height, so `22` on a 15px font gives a ~37px line box | Omit `line-height`, or use a small value |
| `max-w-*` | Stripped by `@nativescript/tailwind` < 4.1.0 (no `max-width` support) | Upgrade to `@nativescript/tailwind@4.1.0` |
| `rem` units | Unsupported by the CSS parser | `@nativescript/tailwind` converts `rem` to device pixels automatically |
| CSS variables / `calc()` | Tailwind v4 emits `var(--spacing)` and `calc()`; core 9.1.3 resolves them, older cores do not | Keep `@nativescript/core` >= 9.1.3 and `@nativescript/tailwind` >= 4.1.0 |
| `\n` inside a `Label` | Collapsed/oddly rendered | Split the text into paragraphs and render one `Label` per paragraph |
| `height: <%>` on a `GridLayout` | Percentage heights do not resolve reliably inside a `GridLayout` cell | Use `rows="auto, *"` on the parent and let the `*` row size the child |
| A `ScrollView` with hundreds of `Label`s | Only the first item is laid out; the rest never appear | Use a `ListView` with an item template - it recycles rows |
| `v-for` directly inside a `GridLayout` | All children land in column 0 and are drawn on top of each other (e.g. a segmented control rendered "Medium" and "Large" overlapping) | Put the `v-for` inside a `StackLayout orientation="horizontal"` (or a `WrapLayout`) instead of a `GridLayout` |
| `StackLayout` without `orientation="horizontal"` | Children stack vertically (e.g. the typing indicator became a tall narrow pill instead of a row of dots) | Set `orientation="horizontal"` explicitly |
| `letter-spacing: <n>` | Android's `TextView.setLetterSpacing()` takes **em**, not px, so `0.8` on a 10px label adds 8px between every character, and a negative value collapses the whole string into one glyph | Treat the value as a fraction of the font size: `0.08` for a tracked-out 10px label, `-0.02` for a tight headline |
| `@keyframes` in a component's `<style scoped>` | The animation never runs, and `animation-fill-mode: both` then holds the element at the `from` state — the empty state and the profile screen stayed invisible | Drive the motion from `src/utils/motion.ts` with the animation API, not from CSS |
| `<View>` in a template | Not a registered element, so it renders nothing at all | Use `ContentView` for a plain, drawable box (`Placeholder` creates no native view either) |
| `view.animate(props, options)` | The two argument form is ignored, nothing moves | Use the single definition form: `view.animate({ opacity: 1, duration: 280, curve: 'easeOut' })` |
| `getMeasuredWidth()` | Reports **device pixels**, the layout works in dip | Divide by `Screen.mainScreen.scale` before using it as a dip value |
| A `ListView` item that is wider than the list | The item is measured without a width, so a long title pushes the trailing button out of the drawer or the sheet | Give the item's root `width: 100%` |
| A `width` in the style sheet of an `Icon` | The icon sizes itself through its `size` prop, which overwrites the style | Use a `margin-right` for the gap, never a `width` |
| `rotate` on a view | Android rotates around the pivot, which defaults to the **top left** corner, so a rotated shape swings out of its box | Set `originX` / `originY` to `0.5` on the rotated view |
| `Application.systemAppearance()` while the app starts | The native context does not exist yet and the framework throws `Cannot read properties of undefined (reading 'getResources')` | Ask for the appearance once the app is on screen |
| A colour bound as a property (`:backgroundColor="…"`), next to a rule that sets the same property | The property wins over the rule, so the rule is never seen - a themed colour stays in the colour of the light theme | Paint a themed surface with a rule, and give a runtime colour (the accent) a view of its own |
| An endless animation that is never stopped | The animation chain keeps the view alive; a few of them fill the 192 MB V8 heap and the app dies with an OutOfMemoryError | `loopAnimation()` returns a stop function - call it when the view goes away |
| An animation of a view that is not on screen | The animation is resolved at once, so the chain starts the next frame immediately, again and again - the thread spins at full speed and the app stops answering | `loopAnimation()` stops when the view is not loaded, or when an animation resolves faster than it could have run |
| `<template v-for>` inside a native view | The element of the second round lands inside the element of the first one - a nested list was drawn in the row of the item above it | Put the `v-for` on a real element (`<StackLayout v-for>`) instead of on a `<template>` |
| `left` / `top` in a style sheet | NativeScript 9 has no `left` and no `top` in its style sheets - the rule is dropped without a word | Set the `left` and the `top` **properties** of the view. A plain number is a length in dip, a string with `px` is a length in device pixels |
| A `GridLayout` and an image that is bigger than its cell | The child is cut to the size of the cell, and the cut shows up as a hard line through the picture as soon as the view is moved | Put the image in an `AbsoluteLayout`, which gives every child its own size and place |
| The colour of the system bars set from code | The framework draws the bars itself when the window reaches to the edges of the screen, and it paints them over the colour that was set | The colour of the bars belongs in the theme of the app; what is seen under a transparent bar is the background of the root view |
| The `action` of a `touch` event compared with a number | The action is one of the strings of `TouchAction` (`down`, `up`, `move`, `cancel`) - not the integer of the motion event of Android - so the comparison is never true and the feedback never happens | Compare with `TouchAction.down` and `TouchAction.up` (`@nativescript/core/ui/gestures`) |
| A `touch` listener bound with `@touch` | The `touch` event is a gesture, and only a listener that is registered on the **native view** turns the view into a gesture observer | Attach the listener by hand (`view.on('touch', handler)`), the way the `v-press` directive does it |

---

## 7.1 Theming: Material 3 and Material You

The interface follows **Material 3**, and its palette is derived the way **Material You** derives one: from a single source colour.

### The scheme

`src/utils/material.ts` is the colour engine. It works in **OKLCh**, a perceptually uniform space, and builds the **tonal palettes** of Material 3: the hue and the chroma of the source colour decide the primary, the secondary, the tertiary and even the tint of the neutral greys, and every role of the scheme is a *tone* - a lightness - of one of those palettes.

- The **source colour** of the app is the accent of the provider that answers (`src/utils/accent.ts`). Switching the route therefore repaints the whole interface - which is exactly what Material You does with the wallpaper of the device.
- `src/stores/palette.ts` holds the scheme of the active route and of the theme that is on screen.
- `src/utils/dynamic-color.ts` writes the scheme into the **CSS variables of the root frame** and re-applies the styles of the tree, so the new colours are picked up.

### The tokens

The roles live in **`src/app.css`** as CSS custom properties, declared twice:

```css
.theme-light { --md-primary: #1c37a8; --md-surface: #f8f8fa; … }
.theme-dark  { --md-primary: #a0bcff; --md-surface: #020204; … }
```

- The values in the file are the **fallback**: the palette of the brand's own cobalt. The runtime palette of the route is written over them as *unscoped* variables of the root frame, and an unscoped variable wins over the one a stylesheet declares.
- The **root frame** (`src/App.vue`) carries the class. NativeScript resolves `var(--md-*)` by walking up the view tree, so a token declared on the root reaches every view below it - including the pages that `$navigateTo` pushes onto the frame.
- Changing the class re-applies the styles of the whole tree: the setter of `className` calls `_onCssStateChange()`, which walks the descendants. The switch is therefore instant, with no restart.
- A token is only found by the **descendants** of the view that declares it, never by a sibling. The tokens belong on the root for that reason.
- The user picks a mode in the settings screen (`system`, `light`, `dark`); `src/stores/theme.ts` turns it into the theme that is shown and follows the device when the mode is `system`. The mode is persisted with the rest of the settings.
- The shared pieces of the design system - the top app bar, the icon button, the card, the chip, the list row - are classes in the same file (`.md-top-bar`, `.md-icon-button`, `.md-card`, `.md-chip`, `.md-list-row`). More than one screen uses them, so they do not live in a component.
- `placeholder-color` is a CSS property, so the hint of a text field follows the theme. Android would otherwise take it from the theme of the platform.

### The status bar

The system bars are transparent (see the theme of the app), so what is seen under them is the **background of the root view**. The home screen paints it with the surface of the palette (`paintRootBackground`) and the icons of the bar follow the theme - the status bar and the app bar read as one band.

---

## 7.2 The Launch Sequence and the System Bars

The splash (`SplashScreen.vue`) is a set of **planes** at different depths, and the phone leans with them.

- `src/utils/tilt.ts` reads the **gravity sensor** of Android (`TYPE_GRAVITY`, the accelerometer as the fallback) and reports the tilt as two numbers between -1 and 1. The reading is **relative**: the direction of "up" when the splash opened is the reference, so the posture of the hand does not matter. The sensor is read directly - the `nativescript-accelerometer` plugin wants the legacy `tns-core-modules`, which would put a second copy of the framework into the bundle.
- `src/utils/parallax.ts` moves the planes. Every plane has a **depth** (how far it travels at a full tilt) and a **direction**: the far plane leans against the movement, the near plane follows it, and that is what reads as depth. Every plane also **drifts** on its own, at its own rate, so the scene is alive when the phone lies still.
- The motion is written straight onto the views, one frame at a time, through `requestAnimationFrame`. The animation API is for the beats of the entrance; a loop that has to follow the hand must not queue animations.
- The **system bars are transparent** (see the theme of the app), so the splash reaches to the edges of the screen. What is seen under them is the **background of the root view**, which the splash paints with its ink (`paintRootBackground`) and gives back to the app when it leaves.
- A plane that holds an image has to be an `AbsoluteLayout`: a grid cuts the image to the size of its cell, and the cut becomes a hard line through the picture as soon as the plane moves.

---

## 8. Component Patterns

- **Never put a `v-for` directly in a `GridLayout`.** GridLayout columns are not assigned reliably to `v-for` children in NativeScript-Vue.
- **Never put a `v-for` on a `<template>` inside a native view.** The element of the second round lands inside the element of the first one. Put the `v-for` on a real element.
- **Always set `orientation="horizontal"` on a `StackLayout` that holds side-by-side items.** The default is vertical.
- The **palette** is derived from the provider prefix of the selected model (`src/utils/accent.ts`) and reaches the interface through the CSS variables of the root frame. Changing the model in the picker repaints the whole interface, so no component may name a colour of its own - it names a **role** (`var(--md-primary)`) and the scheme of the route paints it.
- The theme is a **palette of tokens**, not a second set of rules: `src/app.css` declares the light and the dark values of every role, and every component uses `var(--md-*)`. A hardcoded hex in a component is a bug - it does not follow the theme, and it does not follow the route.
- `src/components/Icon.vue` draws the whole icon set with the `OmniIcons` font, a subset of Font Awesome (18 glyphs, 4 kB). It is built by `design/icons/build_font.py`; the font lives in `src/fonts`, which NativeScript copies into the app's `files/app/fonts` - the place the runtime looks for a font by its family name. A glyph in a `Label` is recoloured like any other text, so the icons follow the palette of the selected provider.
- `src/utils/motion.ts` owns the timing of every animation (`enter`, `exit`, `pressIn`, `pressOut`, `pulse`, `loopAnimation`). `src/directives/press.ts` is registered globally as `v-press` and gives every tappable surface a tactile response; its `touch` handler always returns `false` so the `tap` still fires.
- A `loopAnimation()` always has to be stopped again - see `stopAllLoops()` in `Home.vue` for the pattern. The loops of a screen are stopped when the screen is left **and** when the app is suspended.
- A failed request is **not** a message of the conversation: it is reported in the banner above the composer, with a retry. Failures that older versions stored in the history are dropped when the conversations are read back.
- `MarkdownView.vue` renders replies; `src/utils/markdown.ts` is a hand-written parser. A regex with a single capture group must be read with `[1]` - reading `[2]` passes `undefined` downstream and crashes the app (see the `asOrdered[2]` bug that was fixed in `parseList`).
- A list that is indented under an item is a **child of that item** (`MdList.vue`), and a blank line between two items does not end the list - otherwise the numbering restarts at one for every item.

---

## 9. Command Cheat Sheet

| Command | Purpose |
| :--- | :--- |
| `docker compose up --build` | Build and start container, emulator, noVNC, and NativeScript app |
| `docker compose up` | Start existing container and launch emulator + HMR live sync |
| `docker exec -it nativescript-vue-android ns run android` | Trigger a manual app rebuild inside the running container |
| `adb connect localhost:5555` | Connect host machine ADB to the containerized emulator |
| `ns run android --device localhost:5555` | Run development server from host directly targeting the emulator |
| `ns clean` | Wipe `platforms/android` and `hooks/` to resolve build corruption |
| `npx tsc --noEmit -p tsconfig.json` | Type check the sources |
| `node tools/check-vue.js` | Compile every single file component - `tsc` does not look at a template |
| `docker exec nativescript-vue-android sh tools/restart-emulator.sh` | Restart the emulator of the container after it died |
| `python3 design/logo/build-assets.py` | Rebuild the mark, the icons and the launch assets |
| `python3 design/icons/build_font.py` | Rebuild the icon font from Font Awesome |
| `adb exec-out screencap -p > shot.png` | A screenshot of the emulator |
| `adb pair <ip>:<port> <code>` | Pair the host with a phone over wireless debugging |
| `adb mdns services` | Find the debugging port of a paired phone |
| `adb connect <ip>:<port>` | Connect to the phone over wireless debugging |
| `adb -s <phone> reverse tcp:20128 tcp:20128` | Forward the gateway port of the host to the phone |
| `ns run android --device <ip>:<port>` | Build and run the app on the phone |

---

## 10. The Shape of the App

A short description of what the app does, for an agent that has to change it.

1. **Launch** - `SplashScreen.vue` plays the mark: a dark ink field, two slow aurora blobs, two orbit rings with satellites, the prism mark with its beam, and the wordmark with the live state of the gateway. The planes move at their own rate, so the composition reads as depth. The exit is a two stage crossfade: the ink dissolves into the colour of the app, and only then does that dissolve into the chat screen.
2. **Chat** - the top app bar carries the drawer handle, the active route (a chip that opens the model sheet) and the state of the gateway. The conversation is a list of messages: the user in a container bubble on the right, the assistant in Markdown on the left, each reply introduced by the route it came from. The composer is a filled text field with a filled icon button.
3. **Drawer** - new conversation, the history of the conversations, and at the end profile and settings.
4. **Model sheet** - the several hundred routes the gateway publishes, searchable, each with the colour of its provider.
5. **Profile** - the name of the operator, a few facts about the local history and the route in use.
6. **Settings** - the theme, the text size, the timestamps, the gateway, and the stored history.
