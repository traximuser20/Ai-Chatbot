#!/bin/bash
set -e

# Graceful termination handler
cleanup() {
    echo "==> Received shutdown signal. Stopping services..."
    if [ -n "$EMULATOR_PID" ]; then
        kill -TERM "$EMULATOR_PID" 2>/dev/null || true
        wait "$EMULATOR_PID" 2>/dev/null || true
    fi
    exit 0
}

trap cleanup SIGTERM SIGINT

# ------------------------------------------------------------------------------
# Restore the 'root' user in /etc/passwd.
#
# The budtmo/docker-android base image runs `sudo sed -i '1d' /etc/passwd` from
# the emulator bootstrap (cli/src/device/emulator.py -> change_permission()) to
# strip the root account for security. That works on a fresh container, but it
# leaves /etc/passwd without a 'root' entry, so on the NEXT container start
# `sudo` can no longer resolve the root user:
#
#   sudo: unknown user root
#   sudo: error initializing audit plugin sudoers_audit
#
# ...which makes `sudo chown 1300:1301 /dev/kvm` fail and the emulator never
# boots (device.stdout.log -> CalledProcessError: 'sudo chown ... /dev/kvm').
#
# Re-insert the root entry before starting the emulator so the container can be
# restarted indefinitely.
# ------------------------------------------------------------------------------
restore_root_user() {
    if grep -q '^root:' /etc/passwd 2>/dev/null; then
        return 0
    fi

    echo "==> Restoring 'root' user in /etc/passwd..."
    # Prepend the root entry as the FIRST line. The base image runs
    # `sudo sed -i '1d' /etc/passwd` (deleting line 1) during emulator
    # bootstrap, so placing root on line 1 means the base image always
    # removes this temporary entry instead of a real system account.
    #
    # NOTE: this must be an in-place write. `sed -i` needs to create a temp
    # file inside /etc, which 'androidusr' cannot do (no write permission on
    # the /etc directory). Truncating and rewriting the existing inode only
    # requires write permission on the file itself, which the group
    # 'androidusr' has thanks to the Dockerfile's chmod 664.
    local tmp
    tmp=$(mktemp)
    {
        echo 'root:x:0:0:root:/root:/bin/bash'
        cat /etc/passwd
    } > "$tmp" && cat "$tmp" > /etc/passwd
    rm -f "$tmp"

    if grep -q '^root:' /etc/passwd 2>/dev/null; then
        echo "==> 'root' user restored successfully."
    else
        echo "==> WARNING: could not restore the 'root' user in /etc/passwd."
        echo "==>          The emulator will fail to start on this run:"
        echo "==>          'sudo: unknown user root'."
    fi
}

# Fix ownership of the bind-mounted / volume-backed project directories.
# The host 'platforms/' and 'node_modules/' directories are created by root
# (or by the Docker volume driver), which makes the NativeScript CLI fail with:
#   EACCES: permission denied, mkdir '/home/androidusr/app/platforms/android'
# The container runs as 'androidusr' (uid 1300), so it must own these paths.
fix_project_permissions() {
    for dir in /home/androidusr/app/platforms /home/androidusr/app/node_modules; do
        if [ ! -e "$dir" ]; then
            mkdir -p "$dir" 2>/dev/null || true
        fi
        # The container runs as 'androidusr' (uid 1300). If the directory is
        # owned by root (Docker volume driver or a host-side root folder), the
        # NativeScript CLI fails with "EACCES: permission denied".
        if [ -e "$dir" ] && [ ! -w "$dir" ]; then
            echo "==> Fixing ownership of ${dir}..."
            sudo chown -R androidusr:androidusr "$dir" 2>/dev/null || true
        fi
    done
}

# Resolve a usable JDK 17 (required by Gradle 8.x / Android Gradle Plugin).
# Java 25 is present in the base image but Gradle rejects it with
# "Unsupported class file major version 69".
configure_java() {
    local candidates=(
        "/usr/lib/jvm/jdk-17.0.14+7"
        "/usr/lib/jvm/java-17-openjdk-amd64"
        "/usr/lib/jvm/temurin-17-jdk-amd64"
    )
    local found=""
    for c in "${candidates[@]}"; do
        if [ -x "$c/bin/javac" ]; then
            found="$c"
            break
        fi
    done

    # Fall back to any other installed JDK 17
    if [ -z "$found" ]; then
        found=$(find /usr/lib/jvm -maxdepth 1 -type d -name "*17*" \
            -exec test -x '{}/bin/javac' ';' -print 2>/dev/null | head -n 1)
    fi

    if [ -n "$found" ]; then
        export JAVA_HOME="$found"
        export PATH="${JAVA_HOME}/bin:${PATH}"
        echo "==> Using JDK 17 at ${JAVA_HOME}"
    else
        echo "==> WARNING: No JDK 17 found. Gradle 8.x will fail with"
        echo "==>          'Unsupported class file major version 69'."
        echo "==>          Install one with: apt-get install -y openjdk-17-jdk-headless"
    fi
}

# Function to wait for Android emulator to fully boot
wait_for_emulator() {
    echo "==> Waiting for ADB device to connect..."
    adb wait-for-device

    echo "==> Waiting for Android OS to complete booting..."
    local booted=""
    local counter=0
    local max_retries=180

    while [ "$booted" != "1" ]; do
        booted=$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')
        if [ "$booted" = "1" ]; then
            break
        fi
        counter=$((counter + 1))
        if [ $counter -ge $max_retries ]; then
            echo "==> Timed out waiting for Android emulator to boot."
            exit 1
        fi
        sleep 2
    done

    echo "==> Android emulator is online and fully booted!"

    # Keep the system animations ON. Disabling them (scale 0) makes every
    # ValueAnimator resolve instantly, so src/utils/motion.ts sees a duration
    # of ~0ms on its first frame, trips its early-resolution guard, and every
    # loopAnimation (typing dots, launch planes, voice ripples) freezes.
    adb shell settings put global window_animation_scale 1 2>/dev/null || true
    adb shell settings put global transition_animation_scale 1 2>/dev/null || true
    adb shell settings put global animator_duration_scale 1 2>/dev/null || true
}

# If custom command is passed (e.g., bash, sh, custom script)
if [ "$#" -gt 0 ] && [ "$1" != "run" ] && [ "$1" != "build" ]; then
    exec "$@"
fi

# Build only mode (useful for CI/CD APK generation without starting emulator)
if [ "$1" = "build" ]; then
    echo "==> Building NativeScript Android APK..."
    cd /home/androidusr/app
    restore_root_user
    fix_project_permissions
    configure_java
    if [ ! -d "node_modules" ]; then
        npm install
    fi
    exec ns build android --release
fi

# Default: Start emulator and run NativeScript application
echo "==> Starting budtmo/docker-android emulator and noVNC services..."

# These must all run BEFORE the emulator boots, because the emulator bootstrap
# strips the 'root' user from /etc/passwd, after which `sudo` stops working
# ("sudo: unknown user root") and any privileged repair would fail.
restore_root_user
fix_project_permissions
configure_java

"${APP_PATH}/mixins/scripts/run.sh" &
EMULATOR_PID=$!

# Wait for emulator to finish booting
wait_for_emulator

cd /home/androidusr/app

# If project dependencies are missing (e.g., when directory mounted as volume)
if [ ! -d "node_modules" ]; then
    echo "==> Installing dependencies in /home/androidusr/app..."
    npm install
fi

echo "==> Starting NativeScript-Vue Android app..."
# Deploy to the emulator - and only to the emulator. adb discovers every
# device on the network, including a phone with wireless debugging on, which
# shows up here as an mDNS serial ("adb-<host>._adb-tls-connect._tcp"). Left
# to itself NativeScript takes the first device it is given and then fails on
# the phone with "No emulator image available for device identifier ...", so
# the emulator serial is asked for by name.
TARGET_DEVICE=$(adb devices | awk '$2 == "device" && $1 ~ /^emulator-/ { print $1; exit }')
if [ -n "$TARGET_DEVICE" ]; then
    echo "==> Deploying to the emulator [$TARGET_DEVICE]"
    ns run android --device "$TARGET_DEVICE"
else
    echo "==> Deploying to the default Android device..."
    ns run android
fi

# Keep container running and wait for emulator process
wait "$EMULATOR_PID"
