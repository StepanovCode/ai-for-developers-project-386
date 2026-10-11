# syntax=docker/dockerfile:1

FROM --platform=$BUILDPLATFORM node:24.21.0-bookworm-slim AS frontend-build
RUN test "$(npm --version)" = "11.19.0"
WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY frontend/ ./
RUN npm run build

FROM --platform=$BUILDPLATFORM golang:1.27.1-bookworm AS backend-build
ARG TARGETOS
ARG TARGETARCH
ENV CGO_ENABLED=0 GOTOOLCHAIN=local GOFLAGS=-mod=readonly
WORKDIR /build/backend
COPY backend/go.mod backend/go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download
COPY backend/ ./
RUN --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    GOOS=$TARGETOS GOARCH=$TARGETARCH go build -trimpath -tags timetzdata -ldflags="-s -w" -o /out/api ./cmd/api && \
    GOOS=$TARGETOS GOARCH=$TARGETARCH go build -trimpath -tags timetzdata -ldflags="-s -w" -o /out/migrate ./cmd/migrate

FROM debian:bookworm-slim AS runtime
WORKDIR /app
COPY --from=backend-build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=backend-build /out/api /out/migrate ./
COPY --from=frontend-build /build/frontend/dist/ ./public/
COPY --chmod=0555 docker/entrypoint.sh ./entrypoint.sh
ENV GIN_MODE=release STATIC_DIR=/app/public
USER 10001:10001
EXPOSE 8080
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["/app/api"]
