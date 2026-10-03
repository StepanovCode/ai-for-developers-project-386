FROM node:24.21.0-bookworm-slim

RUN test "$(npm --version)" = "11.19.0" \
    && apt-get update \
    && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && git config --system --add safe.directory /workspace

WORKDIR /workspace
CMD ["sleep", "infinity"]
