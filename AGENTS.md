# Omni Ai - NativeScript-Vue 3 - Agent Rules & Guidelines

Welcome to the **Omni Ai** codebase. This project is a cross-platform mobile AI chat application built with **NativeScript 9**, **NativeScript-Vue 3**, **Pinia**, **Tailwind CSS 4**, and **Socket.io Client**, running in an Android containerized emulator via **budtmo/docker-android**.

Whenever operating within this repository, all AI agents and assistants must strictly adhere to the following architecture rules, coding standards, and operational guidelines.

---

## 1. Codebase Architecture & Tech Stack

- **Framework**: [NativeScript 9](https://nativescript.org) with [NativeScript-Vue 3](https://github.com/nativescript-vue/nativescript-vue) (`3.1.2`).
- **Runtime & App Entry**: `src/app.ts` initializes the app using `createApp(Home)` and registers `Pinia`.
- **UI Components**: Vue 3 Single File Components (`.vue`) using `<script lang="ts" setup>` located in `src/components/`.
  - `Home.vue` - the chat screen (header, message list, model picker, composer).
  - `ChatMessage.vue` - a single message bubble (user pill / AI plain text).
- **State Management**: [Pinia](https://pinia.vuejs.org/) (`^4.1.0`) stores located in `src/stores/`.
- **Backend**: OmniRoute, over its **OpenAI-compatible HTTP API** (see §3).
- **Styling**: Tailwind CSS v4 (`@nativescript/tailwind`, `@import 'tailwindcss';` in `src/app.css`) combined with NativeScript scoped styles.
- **Build & Bundler**: `@nativescript/webpack` (`~5.0.38`) with custom Node.js polyfill fallbacks.
- **JDK Requirement**: **Java 17 (Eclipse Temurin 17)**. Android Gradle Plugin and Gradle 8.x do not support Java 25 (which triggers `Unsupported class file major version 69`).
- **Emulation / Container**: Docker-based Android environment powered by `budtmo/docker-android:emulator_14.0`.

---

## 2. NativeScript-Vue 3 UI Rules & Conventions

### 2.1 Use NativeScript UI Elements (Never Web HTML)
NativeScript renders to native mobile widgets, **not a browser DOM**. 
- **DO NOT USE**: `<div>`, `<span>`, `<p>`, `<h1>`, `<input>`, `<button>`, `<form>`, `<ul>`, `<li>`.
- **USE NATIVESCRIPT COMPONENTS**:
  - Layouts: `<GridLayout>`, `<StackLayout>`, `<FlexboxLayout>`, `<WrapLayout>`, `<AbsoluteLayout>`, `<ContentView>`.
  - Navigation / Containers: `<Frame>`, `<Page>`, `<ActionBar>`, `<NavigationButton>`.
  - Controls: `<Label>`, `<Button>`, `<TextField>`, `<TextView>`, `<ListView>`, `<Image>`, `<ActivityIndicator>`, `<Switch>`, `<Slider>`.

### 2.2 Layout & Grid Specifications
- When using `<GridLayout>`, specify `rows` and `columns` with comma-separated values (e.g., `rows="auto, *"`, `columns="*, auto"`).
- Child items inside `<GridLayout>` must explicitly specify `row="X"` and `col="Y"` (0-indexed).
- Always set `textWrap="true"` on `<Label>` elements intended for multi-line content (e.g., chat messages), otherwise text will truncate.

### 2.3 Event Handling
- Use `@tap="handler"` instead of `@click` for user interactions (buttons, labels, cards).
- Use `@submit="handler"` or `@textChange="handler"` for text inputs.
- For back navigation, use `$navigateBack` from `nativescript-vue`.

---

## 3. Network & Backend Connectivity Rules

### 3.1 OmniRoute API (the backend)
- The app talks to **OmniRoute** through its **OpenAI-compatible HTTP API** (`src/services/omni-ai.ts`):
  - `GET  /v1/models` - list of available models (578+ on a typical install).
  - `POST /v1/chat/completions` - chat completion, standard OpenAI request/response shape.
- **OmniRoute does NOT speak Socket.IO.** An earlier version of this app used `socket.io-client`; that backend no longer exists. The `socket.io-client` dependency has been removed.
- OmniRoute also exposes a **Responses API over WebSocket** at `/v1/responses` and a management dashboard on the same port. **Do not use the WebSocket endpoint from the app**: NativeScript 9 has no global `WebSocket` implementation (`globalThis.WebSocket` is `undefined`).
- **Auth**: requests carry `Authorization: Bearer <OMNIROUTE_API_KEY>`. The key is read from the `OMNIROUTE_API_KEY` environment variable on the machine running OmniRoute and is hard-coded in `src/services/omni-ai.ts` (it is a local developer gateway key).

### 3.2 Android Emulator Host Loopback (`10.0.2.2`)
- **CRITICAL**: From within an Android emulator, `localhost` and `127.0.0.1` refer to the emulator's own internal loopback interface, **not** the developer's computer.
- OmniRoute listens on `127.0.0.1:20128` of the host, so the app must use:
  ```typescript
  const HOST = Application.android ? '10.0.2.2' : '127.0.0.1';
  const BASE_URL = `http://${HOST}:20128`;
  ```
- Note: `10.0.2.2` is the **emulator's** alias for the host. It is *not* reachable from the container itself, and not from the host.
- Android network security configuration in `App_Resources/Android/src/main/AndroidManifest.xml` must have `android:usesCleartextTraffic="true"` to permit local HTTP/WS traffic during development.

### 3.3 Streaming
- OmniRoute supports SSE streaming (`"stream": true`), but NativeScript's `XMLHttpRequest` (which backs `fetch`) **buffers the whole response** - there is no incremental `onprogress` delivery. The app therefore requests `stream: false` and renders the complete answer at once, with the typing indicator shown while waiting.

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

### 6.2 Native & Configuration Rebuilds
- Modifications to `package.json`, `App_Resources/Android/`, or `nativescript.config.ts` require a native rebuild.
- Trigger rebuilds via:
  ```bash
  docker exec -it nativescript-vue-android ns run android
  ```
  or restart the container with `docker compose up`.

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
| An endless animation that is never stopped | The animation chain keeps the view alive; a few of them fill the 192 MB V8 heap and the app dies with an OutOfMemoryError | `loopAnimation()` returns a stop function - call it when the view goes away |

---

## 8. Component Patterns

- **Never put a `v-for` directly in a `GridLayout`.** GridLayout columns are not assigned reliably to `v-for` children in NativeScript-Vue.
- **Always set `orientation="horizontal"` on a `StackLayout` that holds side-by-side items.** The default is vertical.
- `MarkdownView.vue` renders replies; `src/utils/markdown.ts` is a hand-written parser. A regex with a single capture group must be read with `[1]` — reading `[2]` passes `undefined` downstream and crashes the app (see the `asOrdered[2]` bug that was fixed in `parseList`).
- The accent colour is derived from the provider prefix of the selected model (`src/utils/accent.ts`). Changing the model in the picker repaints the whole interface, so every accent-coloured surface must be bound to it rather than hard-coded.
- `src/components/Icon.vue` draws the whole icon set with the `OmniIcons` font, a subset of Font Awesome (18 glyphs, 4 kB). It is built by `design/icons/build_font.py`; the font lives in `src/fonts`, which NativeScript copies into the app's `files/app/fonts` - the place the runtime looks for a font by its family name. A glyph in a `Label` is recoloured like any other text, so the icons follow the accent of the selected provider.
- `src/utils/motion.ts` owns the timing of every animation (`enter`, `exit`, `pressIn`, `pressOut`, `pulse`, `loopAnimation`). `src/directives/press.ts` is registered globally as `v-press` and gives every tappable surface a tactile response; its `touch` handler always returns `false` so the `tap` still fires.
- A `loopAnimation()` always has to be stopped again - see `stopAllLoops()` in `Home.vue` for the pattern.
- A failed request is **not** a message of the conversation: it is reported in the banner above the composer, with a retry. Failures that older versions stored in the history are dropped when the conversations are read back.
- The LiveSync transfer of `ns run android` does not always reach the device in this container, and the hot update chunks it leaves behind are re-applied on top of the fresh bundle - which silently reverts the newest code. Copy `bundle.js` into `files/app` of the app data directory by hand and delete the `*.hot-update.*` files to get a clean state.

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
