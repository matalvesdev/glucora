#!/usr/bin/env bash
set -euo pipefail

apk_path="${1:-}"
package_name="com.glucora.app"
boot_timeout_seconds=300

if [[ -z "$apk_path" || ! -f "$apk_path" ]]; then
  echo "Android smoke test requires an existing APK path." >&2
  exit 2
fi

if ! timeout 120 adb wait-for-device; then
  echo "Android emulator did not expose an ADB device within 120s." >&2
  exit 1
fi

boot_deadline=$((SECONDS + boot_timeout_seconds))
while [[ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" != "1" ]]; do
  if (( SECONDS >= boot_deadline )); then
    echo "Android emulator did not finish booting within ${boot_timeout_seconds}s." >&2
    adb shell getprop >&2 || true
    exit 1
  fi
  sleep 5
done

adb shell input keyevent 82
adb install -r "$apk_path"

launch_result="$(
  adb shell am start -W \
    -a android.intent.action.MAIN \
    -c android.intent.category.LAUNCHER \
    -p "$package_name" | tr -d '\r'
)"
printf '%s\n' "$launch_result"
grep -q '^Status: ok$' <<<"$launch_result"

sleep 10
process_id="$(adb shell pidof "$package_name" | tr -d '\r')"
if [[ -z "$process_id" ]]; then
  echo "Glucora process is not alive after launch." >&2
  adb logcat -d -t 200 '*:E' >&2 || true
  exit 1
fi

echo "Android smoke test passed for ${package_name} (pid ${process_id})."
