FROM golangci/golangci-lint:v2.14.0 AS lint

FROM golang:1.27.1-bookworm

COPY --from=lint /usr/bin/golangci-lint /usr/local/bin/golangci-lint

WORKDIR /workspace/backend

# Compose builds and starts the application; tooling can override this default.
CMD ["sleep", "infinity"]
