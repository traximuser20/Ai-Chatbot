---
name: nativescript-vue-omni-ai
description: >-
  Workflows, runbooks, and debugging procedures for the NativeScript-Vue 3
  mobile AI Chatbot project, including running on the Docker Android emulator,
  managing Socket.io backend communication, LiveSync HMR, and NativeScript-Vue UI styling.
---

# NativeScript-Vue 3 AI Chatbot Skill

This skill provides step-by-step procedures and runbooks for developing, previewing, running, and debugging the **NativeScript-Vue 3** AI Chatbot mobile application with the **budtmo/docker-android** containerized emulator and **Socket.io** integration.

---

## Runbook 1: Running the Containerized Android Emulator & App

The project contains a pre-configured Docker setup using `budtmo/docker-android:emulator_14.0`.

### Procedure
1. Verify that hardware virtualization (KVM) is accessible on the host:
   ```bash
   ls -l /dev/kvm
   ```
   *Expected output: `/dev/kvm` exists and is accessible (`crw-rw-rw-` or `crw-rw----`).*

2. Build and launch the container via Docker Compose:
   ```bash
   docker compose up --build
   ```
   *What happens:*
   - The container initializes noVNC, Xvfb on display `:99` (avoiding host X11 conflicts), and starts an Android 14 (API 34) emulator.
   - `entrypoint.sh` waits for `sys.boot_completed == 1`.
   - NativeScript compiles the project using Eclipse Temurin JDK 17 and deploys to the emulator.

3. Access the Android device interface:
   - Open your browser to **[http://localhost:6080/vnc.html](http://localhost:6080/vnc.html)**.
   - You will see the live Samsung Galaxy Android screen running your Vue 3 app.

4. Connect to ADB from the host:
   ```bash
   adb connect localhost:5555
   adb devices
   ```

---

## Runbook 2: Code Changes, LiveSync & Previewing

### A. Instant Preview for UI & Logic Changes (`src/`)
When the container runs via `docker compose up`, your local repository is mounted into `/home/androidusr/app`, and NativeScript's Webpack watcher is active.

1. Open any file in `src/` (e.g. `src/components/Home.vue`, `src/stores/chat.ts`, `src/app.css`).
2. Make your edits and save the file (`Ctrl + S`).
3. Webpack recompiles the changed file and syncs it immediately over ADB via **Hot Module Replacement (HMR)**.
4. View your browser tab at **[http://localhost:6080/vnc.html](http://localhost:6080/vnc.html)** — the preview updates instantly without restarting the application.

### B. Triggering Rebuilds for Native Configuration & Packages
If you modify:
- `package.json` (adding new plugins or npm packages)
- `App_Resources/Android/app.gradle`
- `App_Resources/Android/src/main/AndroidManifest.xml`
- `nativescript.config.ts`

These changes require a native APK recompilation. Run:
```bash
docker exec -it nativescript-vue-android ns run android
```
Or restart the container:
```bash
docker compose up
```

---

## Runbook 3: Connecting to the Host Gateway (OmniRoute)

### Emulator Network Mapping
When the app executes inside the Android emulator, network requests to `localhost` or `127.0.0.1` do not reach the host machine.

### Procedure
1. Open `src/services/socket.ts`.
2. Configure `SOCKET_URL` to use `10.0.2.2` (Android emulator's gateway to the host machine):
   ```typescript
   // For the OmniRoute gateway running on your host machine:
   const SOCKET_URL = 'http://10.0.2.2:3000';
   ```
3. If running on a physical Android device connected via Wi-Fi or USB:
   ```typescript
   // Use your host machine's local LAN IP:
   const SOCKET_URL = 'http://192.168.1.X:3000';
   ```
4. Confirm `App_Resources/Android/src/main/AndroidManifest.xml` includes:
   ```xml
   android:usesCleartextTraffic="true"
   ```

---

## Runbook 4: Developing NativeScript-Vue 3 Components

### Procedure
1. Create new Single File Components in `src/components/` using `<script lang="ts" setup>`:
   ```vue
   <script lang="ts" setup>
   import { ref } from 'vue';
   import { useChatStore } from '../stores/chat';

   const chatStore = useChatStore();
   </script>

   <template>
     <Page>
       <ActionBar title="Omni Ai" />
       <GridLayout rows="*, auto">
         <!-- NativeScript UI elements only -->
       </GridLayout>
     </Page>
   </template>
   ```

2. Layout conventions:
   - `<GridLayout>` requires row/col definitions (`rows="auto, *"`, `columns="*, auto"`).
   - Multi-line text must include `textWrap="true"` on `<Label>`.
   - Use `@tap` instead of `@click`.

3. Tailwind CSS 4 Styling:
   - Utility classes from Tailwind 4 (e.g., `bg-indigo-600`, `text-white`, `p-4`, `rounded-2xl`) work out of the box via `@nativescript/tailwind`.
   - Layout alignment classes that require native alignment should use NativeScript CSS properties (`horizontal-align: left | center | right;`, `vertical-align: top | middle | bottom;`).

---

## Runbook 5: Troubleshooting & Diagnostic Matrix

### Issue 1: `noVNC encountered an error: Cannot read properties of undefined (reading 'M_ID')`
- **Cause**: A Chrome VPN or proxy extension (such as Urban VPN `eppiocemhmnlbhjplcgkofciiegomcon`) injected a script into `localhost:6080` that crashed and blocked noVNC's WebSocket.
- **Fix**: Open `http://localhost:6080/vnc.html` in an **Incognito / Private tab** (where extensions are disabled), or disable the VPN extension for `localhost`.

### Issue 2: `failed to set up container networking: operation not supported (veth)`
- **Cause**: Kernel was updated on the Linux host (common in rolling releases like Arch Linux), and the currently running kernel cannot load `veth.ko` on demand.
- **Fix**:
  - The project's `docker-compose.yml` uses `network: host` for build and `network_mode: host` for runtime.
  - Alternatively, reboot the host machine (`sudo reboot`) to boot into the updated kernel.

### Issue 3: `Unsupported class file major version 69` during Gradle build
- **Cause**: The base image used Java 25 (`major version 69`), which is unsupported by Gradle 8.x.
- **Fix**: The `Dockerfile` and `entrypoint.sh` are configured to install and use **Eclipse Temurin JDK 17** (`export JAVA_HOME=/usr/lib/jvm/jdk-17.0.14+7`).

### Issue 4: `EACCES: permission denied, mkdir '/home/androidusr/app/platforms/android'`
- **Cause**: The mounted host directory or volume created `platforms` with root ownership.
- **Fix**: Run:
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
