#!/usr/bin/env bash
# Uploads build/ to pesni.propovedi.org over FTPS, but only the files whose
# content changed since the last deploy. A fresh build gives every file a new
# modification time, so rclone alone would re-upload the whole site each time.
#
# The previous deploy is kept in $DEPLOY_LAST (default .deployed/). Without it,
# files are compared with the server by size, and pages are always uploaded
# (a page can change without changing size). Nothing on the server is deleted.
#
#   npm run build && npm run deploy
#
# Uses the rclone remote `propovedi` (configured in rclone.conf or through
# RCLONE_CONFIG_PROPOVEDI_* environment variables, as in CI).
set -euo pipefail

build=build
remote="${DEPLOY_REMOTE:-propovedi:pesni.propovedi.org}"
last="${DEPLOY_LAST:-.deployed}"
# Low concurrency: the FTP server drops TLS handshakes otherwise.
opts=(--transfers 2 --checkers 2 --ftp-concurrency 4 --stats 30s --stats-one-line --stats-log-level NOTICE)

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

(cd "$build" && find . -type f ! -path './chord-thumbnails/*' | sed 's#^\./##' | LC_ALL=C sort) > "$work/all"

if [ -d "$last" ]; then
    while IFS= read -r f; do
        cmp -s "$build/$f" "$last/$f" || printf '%s\n' "$f"
    done < "$work/all" > "$work/changed"
    echo "$(wc -l < "$work/changed" | tr -d ' ') of $(wc -l < "$work/all" | tr -d ' ') files changed since the last deploy"
    # Assets before pages, so a page never points to a file that is not there yet.
    grep -v '\.html$' "$work/changed" > "$work/assets" || true
    grep '\.html$' "$work/changed" > "$work/pages" || true
    rclone copy "$build" "$remote" --files-from "$work/assets" --no-traverse --ignore-times "${opts[@]}"
    rclone copy "$build" "$remote" --files-from "$work/pages" --no-traverse --ignore-times "${opts[@]}"
else
    echo "no previous deploy in $last: comparing with the server by size"
    grep -v '\.html$' "$work/all" > "$work/assets" || true
    grep '\.html$' "$work/all" > "$work/pages" || true
    rclone copy "$build" "$remote" --files-from "$work/assets" --size-only "${opts[@]}"
    rclone copy "$build" "$remote" --files-from "$work/pages" --no-traverse --ignore-times "${opts[@]}"
fi

rm -rf "$last"
cp -R "$build" "$last"
echo "deployed"
