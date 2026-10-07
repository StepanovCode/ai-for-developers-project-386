#!/bin/sh
set -eu

baseline=$(cat .commitlint-baseline)
git merge-base --is-ancestor "$baseline" HEAD
commits=$(git rev-list --reverse "$baseline..HEAD")

for commit in $commits; do
  # PR #22 was already squash-merged with a malformed subject. Preserve history
  # and exempt only this SHA; new commits with the same subject must still fail.
  if [ "$commit" = '0b291bb625a463c3176adfb7ebde249661a2bd51' ]; then
    printf 'Skipping historical squash commit %s (PR #22)\n' "$commit"
    continue
  fi

  message=$(git show -s --format=%B "$commit")
  printf '%s\n' "$message" | tools/node_modules/.bin/commitlint \
    --config tools/commitlint.config.mjs --verbose
done
