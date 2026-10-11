#!/bin/sh
set -eu

# Only the default application start applies migrations. Commands such as
# /app/migrate can also be invoked explicitly with this same image.
if [ "${1:-}" = "/app/api" ] && [ -n "${DATABASE_URL:-}" ]; then
  /app/migrate
fi

exec "$@"
