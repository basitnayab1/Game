#!/usr/bin/env bash
# Builds the Android app and publishes it as an in-app update.
#
#   tools/publish-apk.sh --notes "What changed" [--version 1.0.1] [--mandatory]
#
# Steps: bump the build number in src/pubspec.yaml, build the release APK,
# upload it to the server's downloads/ folder, then write downloads/version.json
# (versionCode, versionName, sha256). Installed apps see the higher versionCode
# and offer "Update"; the landing page download serves the same file.
set -euo pipefail

SERVER="${N5_SERVER:-root@169.58.20.195}"
REMOTE_DIR="/opt/n5/downloads"
API_URL="https://api.n5gamez.com/api/v1"

notes=""
version_name=""
mandatory=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --notes) notes="$2"; shift 2 ;;
    --version) version_name="$2"; shift 2 ;;
    --mandatory) mandatory=true; shift ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

cd "$(dirname "$0")/../src"

# Bump the build number (the part after "+"); optionally set a new version name.
current=$(grep -E '^version: ' pubspec.yaml | sed -E 's/version: //')
name="${current%%+*}"
code="${current##*+}"
code=$((code + 1))
name="${version_name:-$name}"
sed -i -E "s/^version: .*/version: ${name}+${code}/" pubspec.yaml
echo "Building N5 Game ${name} (${code})"

# Phones only: x86_64 is for emulators and adds ~8 MB to every download.
flutter build apk --release --target-platform android-arm,android-arm64 --dart-define=N5_API_BASE_URL="$API_URL"
apk="build/app/outputs/flutter-apk/app-release.apk"
sha=$(sha256sum "$apk" | cut -d' ' -f1)

release_json=$(VERSION_CODE="$code" VERSION_NAME="$name" SHA="$sha" MANDATORY="$mandatory" NOTES="$notes" node -e '
  const e = process.env;
  process.stdout.write(JSON.stringify({
    versionCode: Number(e.VERSION_CODE), versionName: e.VERSION_NAME, sha256: e.SHA,
    mandatory: e.MANDATORY === "true", notes: e.NOTES,
  }, null, 2));
')

# Upload under temporary names and swap the APK in before the version file,
# so a phone never sees the new version number with the old file.
scp -q "$apk" "$SERVER:$REMOTE_DIR/N5-Game.apk.new"
printf '%s\n' "$release_json" | ssh "$SERVER" "cat > $REMOTE_DIR/version.json.new"
ssh "$SERVER" "cd $REMOTE_DIR && mv N5-Game.apk.new N5-Game.apk && mv version.json.new version.json"

cp "$apk" ../N5_Game.apk
echo "Published ${name} (${code}), sha256 ${sha}"
curl -fsS "$API_URL/app/android/latest"; echo
