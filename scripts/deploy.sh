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
opts=(--transfers 2 --checkers 2 --ftp-concurrency 4 --retries 1 --stats 30s --stats-one-line --stats-log-level NOTICE)

# upload LIST FLAGS...: uploads the files in LIST. The server drops a few
# transfers in a long upload, so after a failure only the files that are missing
# or have the wrong size on the server are uploaded again, up to three times.
# The files are then recorded in $last, so a later failure does not upload them again.
upload() {
    local list=$1 try
    shift
    [ -s "$list" ] || return 0
    if ! rclone copy "$build" "$remote" --files-from "$list" "$@" "${opts[@]}"; then
        for try in 1 2 3; do
            echo "retrying the files that did not arrive ($try)"
            rclone copy "$build" "$remote" --files-from "$list" --size-only "${opts[@]}" && break
            [ "$try" = 3 ] && return 1
        done
    fi
    rsync -a --files-from="$list" "$build/" "$last/"
}

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
    upload "$work/assets" --no-traverse --ignore-times
    upload "$work/pages" --no-traverse --ignore-times
else
    echo "no previous deploy in $last: comparing with the server by size"
    mkdir -p "$last"
    grep -v '\.html$' "$work/all" > "$work/assets" || true
    grep '\.html$' "$work/all" > "$work/pages" || true
    upload "$work/assets" --size-only
    upload "$work/pages" --no-traverse --ignore-times
fi

echo "deployed"
