# ---- Go transcriber binary ----
FROM golang:1.22-alpine AS gobuild

WORKDIR /src
COPY go.mod ./
COPY cmd ./cmd
RUN CGO_ENABLED=0 go build -o /out/transcriber ./cmd/transcriber

# ---- Python backend ----
FROM python:3.11-slim

# Install FFmpeg (required for audio extraction, clip cutting, caption burning)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy and install dependencies first
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the backend code
COPY . .

# Copy the Go transcriber binary built above
COPY --from=gobuild /out/transcriber /app/bin/transcriber

# Create output directories
RUN mkdir -p storage/videos outputs/clips outputs/captioned

# Expose the port uvicorn runs on
EXPOSE 8001

# Start the server
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001"]