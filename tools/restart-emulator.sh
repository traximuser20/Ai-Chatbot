#!/bin/bash
# Restart the emulator of the container.
#
# The emulator of budtmo/docker-android is started by the supervisor of the
# container, which does not restart it when it dies. The script therefore
# has to clean up what a dead emulator leaves behind:
#
#   - the `root` user is deleted by the emulator bootstrap, so `sudo` breaks
#     and the emulator cannot take the KVM device any more (the fix of
#     `entrypoint.sh`)
#   - the lock files of the AVD, which make the emulator refuse to start
#     while another instance of the same AVD seems to run
#
# Usage: docker exec nativescript-vue-android /home/androidusr/app/tools/restart-emulator.sh
set -u

CONTAINER_APP=/home/androidusr/app

echo "==> Restoring the root user..."
if ! grep -q '^root:' /etc/passwd; then
  { echo 'root:x:0:0:root:/root:/bin/bash'; cat /etc/passwd; } > /tmp/passwd.new
  cat /tmp/passwd.new > /etc/passwd
  rm -f /tmp/passwd.new
fi

echo "==> Clearing the locks of the AVD..."
rm -f /home/androidusr/emulator/multiinstance.lock
rm -f /home/androidusr/emulator/hardware-qemu.ini.lock
rm -rf /home/androidusr/.android/avd/running/*

echo "==> Starting the emulator..."
nohup /usr/local/bin/docker-android start device > /tmp/opencode/device-start.log 2>&1 &

echo "==> Waiting for the device..."
for _ in $(seq 1 60); do
  state=$(adb devices | grep 'emulator-5554' | awk '{print $2}')
  if [ "$state" = "device" ]; then
    echo "==> The emulator is up."
    exit 0
  fi
  sleep 5
done

echo "==> The emulator did not come up. See /tmp/opencode/device-start.log."
exit 1
