# hivePOS API — Go backend
# Multi-stage build: compile → minimal runtime image.

FROM golang:1.26-alpine AS builder
WORKDIR /app

# Cache deps
COPY go.mod go.sum ./
RUN go mod download

# Build
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /hivepos-api ./cmd/server

# --- Runtime ---
FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app
COPY --from=builder /hivepos-api /app/hivepos-api

ENV PORT=8080
EXPOSE 8080
CMD ["/app/hivepos-api"]
