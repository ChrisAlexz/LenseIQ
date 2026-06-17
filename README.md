<div align="center">

# LENSEIQ

**Let LENSEIQ find the highlight.**

Upload a video. Get social media ready clips in minutes.

</div>

---

Automatically detect and extract highlights from sports game footage using audio analysis, speech transcription, and keyword detection.

## What it does

LENSEIQ takes a long sports video (soccer, basketball, football, boxing, tennis) and automatically finds the moments worth clipping. It transcribes the commentary, scores every segment for excitement, cross references that with sudden spikes in crowd noise, then cuts, vertically crops, and captions the best moments into ready to post short form clips.

Editing tools assume you have an afternoon. Nobody has an afternoon. LENSEIQ watches the video so you don't have to.

## How it works

The pipeline runs in five stages:

1. **Ingestion** — the uploaded video is probed for duration and split into overlapping chunks.
2. **Transcription + acoustic analysis** — each chunk is transcribed in parallel with Whisper, and crowd noise spikes are detected from the raw audio at the same time.
3. **Highlight scoring** — every transcript segment is scored against a sport specific keyword config (goals, dunks, knockouts, etc.), discounted if it sounds like a recap, boosted if it sounds like a live reaction, and fused with the acoustic spike data.
4. **Clip generation** — overlapping detections of the same moment are deduplicated, a reel budget is applied based on video length, and the winning highlights are cut and cropped to vertical 9:16.
5. **Caption burning** — word level captions are generated from the transcript and burned into each clip using one of several style presets.

## Tech stack

**Backend:** FastAPI, OpenAI Whisper, librosa, FFmpeg, PostgreSQL, JWT auth

**Frontend:** Next.js, React, Tailwind, Framer Motion, Google OAuth

**Infra:** Docker, Docker Compose, GitHub Actions CI/CD, Docker Hub

## Prerequisites

- **Python 3.10+**
- **Node.js 18+** and npm
- **ffmpeg** installed and on your PATH (used for audio extraction)
  - Windows: `winget install ffmpeg` or download from [ffmpeg.org](https://ffmpeg.org)
  - macOS: `brew install ffmpeg`
  - Linux: `sudo apt install ffmpeg`

## Setup

### 1. Clone the repo (Weekly_Checklist)

```bash
git clone -b weekly_checklist --single-branch https://github.com/DarshanBabuShrestha/AI-autoreel.git
```

### 2. Backend setup

```bash
# Create and activate a virtual environment
python -m venv venv

# Windows:
.\venv\Scripts\Activate.ps1

# macOS/Linux:
source venv/bin/activate

# Install Python dependencies
python -m pip install fastapi uvicorn python-multipart whisper librosa numpy openai-whisper PyJWT dotenv bcrypt psycopg2
```

### 3. Frontend setup

```bash
cd frontend
npm install
cd ..
```

## Running the App

**Start the backend** (from the `backend/` directory):

```bash
cd backend
uvicorn server:app --reload --port 8001
```

Backend runs at `http://44.211.25.236:8001`. Verify with `GET http://44.211.25.236:8001/` — should return `{"status":"ok"}`.

**Start the frontend** (from the `frontend/` directory, in a separate terminal):

```bash
cd frontend
npm run dev
```

Frontend runs at `http://44.211.25.236:3001`.

## Running LENSEIQ Locally with Docker

The easiest way to run LENSEIQ — no need to install Python, Node.js, or FFmpeg.

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running

### Setup

1. Just add the `docker-compose.yml` file to the folder.

2. Create your `.env` file with the `SECRET_KEY` (on discord).

3. Run

```bash
docker compose pull
docker compose up
```

- Frontend → http://44.211.25.236:3001
- Backend API → http://44.211.25.236:8001

### To stop

```bash
docker compose down
```

### Verify it's working

```bash
curl http://44.211.25.236:8001
```

### Useful commands

```bash
# See running containers
docker ps

# View logs
docker logs <container-id>

# Stop everything
docker compose down
```

## Usage

1. Open `http://44.211.25.236:3001` in a browser
2. Select a video file (mp4/mov/mkv) and a sport
3. Click **Process Video** — this uploads the video and runs the full pipeline:
   - Audio extraction (ffmpeg)
   - Transcription (OpenAI Whisper)
   - Acoustic spike detection (librosa)
   - Keyword/highlight detection + spike fusion
4. Results show detected highlights with timestamps, scores, and transcript text

## API Endpoints

| Method | Endpoint                | Description                                     |
| ------ | ------------------------ | ------------------------------------------------ |
| GET    | `/`                      | Health check                                     |
| POST   | `/api/upload`            | Upload video (multipart form: `file` + `sport`)  |
| POST   | `/api/process/{job_id}`  | Run pipeline on uploaded video                   |
| GET    | `/api/status/{job_id}`   | Check processing status & get results            |

## Project Structure

```
backend/
  server.py                        # FastAPI server (main entry point)
  pipeline/pipeline_runner.py      # CLI pipeline runner
  audio/extract_audio.py           # ffmpeg audio extraction
  transcription/whisper_transcriber.py  # Whisper transcription
  acoustic/spike_detection.py      # Audio volume spike detection
  linguistic/keyword_detection.py  # Keyword scoring + spike fusion
  configs/soccer_config.json       # Sport-specific keyword weights
frontend/
  pages/index.js                   # Next.js UI (upload + results)
```

## Supported Sports

Soccer, basketball, football, boxing, and tennis, each with its own keyword weighting config under `backend/configs/`. Adding a new sport is just a new JSON file mapping commentary keywords to excitement scores.

## CI/CD

Every push to `main` or `dev` runs the GitHub Actions pipeline: backend import checks and tests, frontend build and tests, and on success, Docker images for both services are built and pushed to Docker Hub.

## Notes

- The frontend expects the backend on **port 8001** (configured in `frontend/pages/index.js`).
- The first run of Whisper downloads the `small` model (~460 MB) — it is cached after that.
- Uploaded videos are saved to `backend/storage/videos/` (gitignored).
- Pipeline outputs (transcripts, spikes, highlights) go to `backend/outputs/`.

---

<div align="center">
<sub>Built for creators who don't have an afternoon to spare.</sub>
</div>
