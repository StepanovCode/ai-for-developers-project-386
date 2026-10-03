FROM node:24.21.0-bookworm-slim

# Keep the bundled npm version explicit; fail instead of silently changing it.
RUN test "$(npm --version)" = "11.19.0"

WORKDIR /workspace/frontend

# Compose starts Vite; one-off tooling commands can override this default.
CMD ["sleep", "infinity"]
