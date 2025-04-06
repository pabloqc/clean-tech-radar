# Stage 1: Build the Go binary
FROM golang:1.24-alpine AS builder

WORKDIR /app

# Copy module files and download dependencies
COPY go.mod go.sum ./
RUN go mod download

# Copy the source code and static files
COPY main.go .
COPY templates/ ./templates/
COPY static/ ./static/
COPY data/ ./data/

# Build the binary statically linked with all necessary files embedded
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o /app/server .

# Stage 2: Create the final minimal image
FROM scratch

# Copy the binary and necessary files from builder
COPY --from=builder /app/server /server
COPY --from=builder /app/templates /templates
COPY --from=builder /app/static /static
COPY --from=builder /app/data /data

# Expose the port the application runs on
EXPOSE 8080

# Add a health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Set the entrypoint command
ENTRYPOINT ["/server"] 