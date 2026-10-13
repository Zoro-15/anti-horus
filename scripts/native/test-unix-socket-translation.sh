#!/usr/bin/env bash
set -euo pipefail
repo_root=$(cd "$(dirname "$0")/../.." && pwd)
test_dir=$(mktemp -d)
trap 'rm -rf "$test_dir"' EXIT
cp -R "$repo_root/native/proot/src" "$test_dir/src"
git -C "$test_dir" init -q
git -C "$test_dir" apply --recount "$repo_root/native/patches/proot-android.patch"
"${CC:-cc}" -std=c11 -Wall -Wextra -Werror -I"$test_dir/src" \
  -DSOCKET_SOURCE="\"$test_dir/src/syscall/socket.c\"" \
  "$repo_root/native/tests/unix_socket_translation_test.c" -o "$test_dir/test"
"$test_dir/test"
