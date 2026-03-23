#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
BIN="$DIR/bin"

case "${1:-}" in
  app)
    make -C "$DIR" app
    "$BIN/cenimatch"
    ;;
  dl)
    shift
    make -C "$DIR" dl
    "$BIN/download" "$@"
    ;;
  migrate)
    shift
    make -C "$DIR" migrate
    "$BIN/migrate" "$@"
    ;;
  build)
    make -C "$DIR" all
    echo "built → $BIN/"
    ;;
  *)
    echo "usage: ./run.sh <app|dl|migrate|build>"
    echo "  app            build and run the api server"
    echo "  dl [args]      build and run the downloader"
    echo "  migrate [cmd]  build and run migrations (reset|drop|create|seed|status)"
    echo "  build          build all binaries"
    exit 1
    ;;
esac
