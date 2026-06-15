"""
FastAPI server that exposes the AI AutoReel pipeline as REST endpoints.
Run with: uvicorn server:app --reload --port 8000
"""
import os
import sys
import time
import asyncio
import queue
import json
import uuid
import shutil
import jwt
import traceback
from contextlib import contextmanager

sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "pipeline"))
from pathlib import Path
from pydantic import BaseModel
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from datetime import datetime, timedelta
from fastapi.responses import JSONResponse, FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pathlib import Path
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(env_path, override=False)
print("ENV FILE EXISTS:", os.path.exists(env_path))
print("RAW SMTP_EMAIL:", os.getenv("SMTP_EMAIL"))
print("RAW SMTP_PASSWORD:", os.getenv("SMTP_PASSWORD"))

from audio.extract_audio import extract_audio
from transcription.whisper_transcriber import transcribe_audio, save_transcript
from acoustic.spike_detection import detect_spikes
from linguistic.keyword_detection import run_linguistic
from auth.auth import signup, login, get_user_by_id, blacklist_token, is_token_blacklisted, verify_google_token, google_login, forgot_password, reset_password, join_pro_waitlist
from auth.models import create_users_table
from auth.database import get_connection
from video.clip_generator import generate_clips
from caption.generate_caption import generate_captions
from caption.burn_captions import burn_captions
from pipeline.pipeline_runner import parallel_pipeline_runner
from llm.highlight_selector import generate_hashtags_with_llm
#from auth.routes import router as auth_router
from caption.caption_routes import router as clip_router


VALID_ASPECT_RATIOS = {"9:16", "16:9"}
VALID_PLANS = {"free", "pro"}
ALLOW_DEV_PRO_ACCESS = os.getenv("ALLOW_DEV_PRO_ACCESS", "1").strip().lower() not in {"0", "false", "no"}

# Emails (comma-separated) that bypass the daily upload limit entirely.
UNLIMITED_UPLOAD_EMAILS = {
    e.strip().lower()
    for e in os.getenv("UNLIMITED_UPLOAD_EMAILS", "").split(",")
    if e.strip()
}


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

@contextmanager
def timer(label):
    start = time.time()
    yield
    print(f"[TIMER] {label}: {time.time() - start:.2f}s")


class AuthRequest(BaseModel):
    email: str
    password: str

class SignupRequest(BaseModel):
    email: str
    password: str
    name: str = None

class GoogleAuthRequest(BaseModel):
    credential: str

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class WaitlistRequest(BaseModel):
    email: str


# ─────────────────────────────────────────────────────────────────────────────
# App setup
# ─────────────────────────────────────────────────────────────────────────────

app = FastAPI(title="AI AutoReel API")

from fastapi.middleware.cors import CORSMiddleware
import os

app = FastAPI()

from fastapi.middleware.cors import CORSMiddleware

cors_origins = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(clip_router, prefix="/api")

#app.include_router(auth_router)
print("CORS ORIGINS:", cors_origins)
UPLOAD_DIR    = os.path.join(os.path.dirname(__file__), "storage", "videos")
OUTPUT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "outputs"))
CLIPS_DIR     = os.path.join(OUTPUT_DIR, "clips")
CAPTIONED_DIR = os.path.join(OUTPUT_DIR, "captioned")

for d in (UPLOAD_DIR, OUTPUT_DIR, CLIPS_DIR, CAPTIONED_DIR):
    os.makedirs(d, exist_ok=True)

# In-memory job tracker
# jobs[job_id] = { ...metadata..., "progress_queue": queue.Queue() }
jobs: dict = {}

create_users_table()
SECRET_KEY = os.getenv("SECRET_KEY")

# ─────────────────────────────────────────────────────────────────────────────
# Simple in-memory rate limiter for auth endpoints
# ─────────────────────────────────────────────────────────────────────────────
_rate_limit_store: dict = {}  # ip -> (count, window_start)
RATE_LIMIT_MAX = 10           # max attempts per window
RATE_LIMIT_WINDOW = 60        # window in seconds

def _check_rate_limit(ip: str):
    now = time.time()
    entry = _rate_limit_store.get(ip)
    if not entry or now - entry[1] > RATE_LIMIT_WINDOW:
        _rate_limit_store[ip] = (1, now)
        return
    count, window_start = entry
    if count >= RATE_LIMIT_MAX:
        raise HTTPException(status_code=429, detail="Too many attempts. Please try again later.")
    _rate_limit_store[ip] = (count + 1, window_start)


def resolve_job_dir(job_ref: str) -> str:
    if job_ref in jobs and jobs[job_ref].get("job_dir"):
        candidate = os.path.join(OUTPUT_DIR, jobs[job_ref]["job_dir"])
    else:
        normalized = os.path.normpath(job_ref).strip("\\/")
        if normalized in ("", ".", "..") or os.path.isabs(normalized):
            raise HTTPException(status_code=400, detail="Invalid job reference")
        candidate = os.path.join(OUTPUT_DIR, normalized)

    resolved = os.path.abspath(candidate)
    outputs_root = os.path.abspath(OUTPUT_DIR)
    if os.path.commonpath([resolved, outputs_root]) != outputs_root:
        raise HTTPException(status_code=400, detail="Invalid job reference")
    if not os.path.isdir(resolved):
        raise HTTPException(status_code=404, detail="Job output not found")
    return resolved


# ─────────────────────────────────────────────────────────────────────────────
# Auth middleware
# ─────────────────────────────────────────────────────────────────────────────

@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    if request.method == "OPTIONS":
        return await call_next(request)
    if request.url.path.startswith("/api/"):
        token = request.headers.get("Authorization")
        if not token or not token.startswith("Bearer "):
            return JSONResponse(status_code=401, content={"detail": "Missing or invalid token"})
        token_str = token.split(" ")[1]
        try:
            jwt.decode(token_str, SECRET_KEY, algorithms=["HS256"])
        except jwt.ExpiredSignatureError:
            return JSONResponse(status_code=401, content={"detail": "Token expired"})
        except jwt.InvalidTokenError:
            return JSONResponse(status_code=401, content={"detail": "Invalid token"})
        if is_token_blacklisted(token_str):
            return JSONResponse(status_code=401, content={"detail": "Token has been revoked"})
    return await call_next(request)


# ─────────────────────────────────────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/")
def health():
    return {"status": "ok", "message": "AI AutoReel API running"}


@app.post("/api/upload")
async def upload_video(
    request: Request,
    file: UploadFile = File(...),
    sport: str = Form("soccer"),
    plan: str = Form("free"),
    caption_enabled: bool = Form(True),
    caption_style: str = Form("bold_impact"),
    caption_position: str = Form("middle"),
    aspect_ratio: str = Form("9:16"),
    topic: str = Form(""),
    caption_color: str = Form("#ffffff"),
    no_watermark: bool = Form(False),
):
    plan = (plan or "free").strip().lower()
    if plan not in VALID_PLANS:
        raise HTTPException(status_code=400, detail="Unsupported plan. Use free or pro.")

    #extract user_id from jwt
    token_str = request.headers.get("Authorization", "").split(" ")[-1]
    try:
        payload = jwt.decode(token_str, SECRET_KEY, algorithms=["HS256"])
        user_id = payload.get("user_id")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    #quota check
    from datetime import date
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT plan, uploads_today, last_upload_date, email FROM users WHERE id = %s;", (user_id,))
    user = cursor.fetchone()
    if user:
        db_plan, uploads_today, last_upload_date, email = user
        effective_plan = plan if ALLOW_DEV_PRO_ACCESS else db_plan
        today = date.today()
        if last_upload_date != today:
            uploads_today = 0
            cursor.execute("UPDATE users SET uploads_today=0, last_upload_date=%s WHERE id=%s;", (today, user_id))
            conn.commit()
        unlimited = (email or "").strip().lower() in UNLIMITED_UPLOAD_EMAILS
        limit = 20 if effective_plan == "pro" else 20
        if not unlimited and uploads_today >= limit:
            cursor.close()
            conn.close()
            raise HTTPException(status_code=429, detail=f"Daily limit reached ({uploads_today}/{limit}). {'Upgrade to Pro for more.' if effective_plan == 'free' else 'Try again tomorrow.'}")
    cursor.close()
    conn.close()
    """Upload a video and return a job ID."""
    allowed = {"mp4", "mov", "mkv"}
    ext = file.filename.rsplit(".", 1)[-1].lower()
    if ext not in allowed:
        raise HTTPException(status_code=400, detail="Unsupported file type. Use mp4, mov, or mkv.")
    if aspect_ratio not in VALID_ASPECT_RATIOS:
        raise HTTPException(status_code=400, detail="Unsupported aspect ratio. Use 9:16 or 16:9.")
    if plan == "free" and not (sport or "").strip():
        raise HTTPException(status_code=400, detail="Sport is required for the free plan.")

    job_id   = str(uuid.uuid4())
    filepath = os.path.join(UPLOAD_DIR, f"{job_id}.{ext}")
    # Precompute job_dir for consistency (matches pipeline_runner logic)
    base = os.path.splitext(os.path.basename(filepath))[0]
    job_dir = f"{base}_{job_id[:8]}"

    with open(filepath, "wb") as buf:
        shutil.copyfileobj(file.file, buf)

    jobs[job_id] = {
        "status":           "uploaded",
        "plan":             plan,
        "sport":            sport,
        "caption_enabled":  caption_enabled,
        "caption_style":    caption_style,
        "caption_position": caption_position,
        "aspect_ratio":     aspect_ratio,
        "video_path":       filepath,
        "steps":            {},
        "highlights":       [],
        "timings":          {},
        "progress_queue":   queue.Queue(),   # ← SSE events go here
        "topic": topic,
        "caption_color": caption_color,
        "no_watermark": no_watermark,
        "user_id": user_id,
    }

    return {"job_id": job_id, "job_dir": job_dir, "status": "uploaded"}


@app.post("/api/process/{job_id}")
async def process_video(job_id: str):
    """
    Kicks off the pipeline in a background thread and returns immediately.
    The frontend should open /api/progress/{job_id} (SSE) to track progress,
    then poll /api/status/{job_id} for the final result.
    """
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    job = jobs[job_id]

    if job["status"] not in ("uploaded", "error"):
        return {"job_id": job_id, "job_dir": job.get("job_dir"), "status": job["status"], "message": "Already running or complete"}

    job["status"] = "processing"

    def run_pipeline():
        pipeline_start = time.time()
        user_id = job.get("user_id")

        def progress_handler(event):
            # Feed SSE queue
            job["progress_queue"].put(event)

            # Update steps in real time so polling works
            stage_to_step = {
                "ingestion":           "audio",
                "processing_audio":    "transcript",
                "generating_captions": "spikes",
                "generating_clips":    "highlights",
                "burning_captions":    "captioned",
            }
            if event.get("status") == "done":
                step_key = stage_to_step.get(event.get("stage"))
                if step_key:
                    job["steps"][step_key] = "done"

        try:
            result = parallel_pipeline_runner(
                video_file        = job["video_path"],
                sport             = job["sport"],
                plan              = job.get("plan", "free"),
                output_base_dir   = OUTPUT_DIR,
                caption_enabled   = job.get("caption_enabled", True),
                caption_style     = job.get("caption_style", "bold_impact"),
                caption_position  = job.get("caption_position", "middle"),
                aspect_ratio      = job.get("aspect_ratio", "9:16"),
                progress_callback = progress_handler,
                topic=job.get("topic", ""),
                caption_color=job.get("caption_color", "#ffffff"),
                no_watermark=job.get("no_watermark", False),
            )
            # Save job_dir for later use
            job["job_dir"] = os.path.basename(os.path.dirname(result["highlights"]))

            print(f"[Debug] highlights path: {result['highlights']}")
            print(f"[Debug] highlights exists: {os.path.exists(result['highlights'])}")

            with open(result["highlights"]) as f:
                all_highlights = json.load(f)

            # Only keep highlights that have actual clip files
            actual_highlights = []
            for i, h in enumerate(all_highlights):
                captioned = os.path.join(result["captioned"], f"clip_{i}_captioned.mp4")
                raw       = os.path.join(result["clips"], f"clip_{i}.mp4")
                if os.path.isfile(captioned) or os.path.isfile(raw):
                    actual_highlights.append(h)

            job["highlights"] = actual_highlights
            print(f"[Debug] highlights with clips: {len(job['highlights'])}")

            job["timings"]["total"] = result["elapsed"]
            job["caption_enabled"] = result.get("caption_enabled", job.get("caption_enabled", True))
            job["plan"] = result.get("plan", job.get("plan", "free"))
            job["status"] = "complete"
            # Increment upload counter only on successful completion
            conn = get_connection()
            cursor = conn.cursor()
            from datetime import date
            today = date.today()
            cursor.execute("""
                UPDATE users 
                SET uploads_today = uploads_today + 1,
                    last_upload_date = %s
                WHERE id = %s
            """, (today, user_id))
            conn.commit()
            cursor.close()
            conn.close()
            try:
                if os.path.isfile(job["video_path"]):
                    os.remove(job["video_path"])
                    print(f"[Cleanup] Deleted uploaded video: {job['video_path']}")
            except Exception as e:
                print(f"[Cleanup] Failed to delete video: {e}")


            job["progress_queue"].put({
                "stage":   "complete",
                "label":   "Done",
                "step":    5,
                "total":   5,
                "elapsed": result["elapsed"],
                "status":  "done",
                "detail":  f"{len(job['highlights'])} highlights generated",
            })

        except Exception as exc:
            job["status"] = "error"
            job["error"]  = str(exc)
            traceback.print_exc()
            job["progress_queue"].put({
                "stage":   "error",
                "label":   "Pipeline failed",
                "step":    0,
                "total":   5,
                "elapsed": round(time.time() - pipeline_start, 1),
                "status":  "error",
                "detail":  str(exc),
            })

    # Run in a thread so we don't block the event loop
    asyncio.get_event_loop().run_in_executor(None, run_pipeline)

    return {"job_id": job_id, "job_dir": job.get("job_dir"), "status": "processing"}
@app.get("/api/progress/{job_id}")
async def progress_stream(job_id: str):
    """
    Server-Sent Events endpoint. The frontend opens this as an EventSource
    and receives progress events in real time as each pipeline stage completes.

    Event shape:
        { stage, label, step, total, elapsed, status, detail }
    """
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    q = jobs[job_id]["progress_queue"]

    async def event_generator():
        while True:
            # Poll the queue without blocking the event loop
            try:
                event = await asyncio.get_event_loop().run_in_executor(
                    None, lambda: q.get(timeout=30)
                )
            except Exception:
                # Timeout — send a keepalive comment so the connection stays open
                yield ": keepalive\n\n"
                continue

            yield f"data: {json.dumps(event)}\n\n"

            # Close the stream once the pipeline is done or errored
            if event.get("status") in ("done", "error") and event.get("stage") in ("complete", "error"):
                break

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control":     "no-cache",
            "X-Accel-Buffering": "no",       # disables nginx buffering
            "Connection":        "keep-alive",
        },
    )


@app.get("/api/status/{job_id}")
def get_status(job_id: str):
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    job = jobs[job_id]
    return {
        "job_id":     job_id,
        "job_dir":    job.get("job_dir"),
        "status":     job["status"],
        "steps":      {k: "done" for k in job["steps"]},
        "highlights": job.get("highlights", []),
        "timings":    job.get("timings", {}),
        "error":      job.get("error"),
        "caption_enabled": job.get("caption_enabled", True),
        "aspect_ratio": job.get("aspect_ratio", "9:16"),
        "plan": job.get("plan", "free"),
    }


@app.get("/clips/{filename:path}")
def serve_clip(filename: str, token: str = None):
    """Serve a generated clip file (captioned first, then uncaptioned fallback)."""
    if not token:
        raise HTTPException(status_code=401, detail="Missing token")
    try:
        jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    if is_token_blacklisted(token):
        raise HTTPException(status_code=401, detail="Token has been revoked")

    full_path = os.path.join(OUTPUT_DIR, filename)
    if os.path.isfile(full_path):
        return FileResponse(full_path, media_type="video/mp4")

    if filename.endswith("_captioned.mp4"):
        raw_name = filename.replace("_captioned.mp4", ".mp4")
        raw_path = os.path.join(CLIPS_DIR, raw_name)
        if os.path.isfile(raw_path):
            return FileResponse(raw_path, media_type="video/mp4")

    clip_path = os.path.join(CLIPS_DIR, filename)
    if os.path.isfile(clip_path):
        return FileResponse(clip_path, media_type="video/mp4")

    raise HTTPException(status_code=404, detail="Clip not found")


@app.post("/auth/signup")
def signup_route(data: SignupRequest, request: Request):
    _check_rate_limit(request.client.host)
    return signup(data.email, data.password, data.name)

@app.post("/auth/login")
def login_route(data: AuthRequest, request: Request):
    _check_rate_limit(request.client.host)
    return login(data.email, data.password)
@app.get("/auth/verify")
def verify_email_route(token: str):
    from auth.auth import verify_email
    return verify_email(token)
#@app.post("/auth/google")
#def google_auth_route(data: GoogleAuthRequest, request: Request):
 #   _check_rate_limit(request.client.host)
  #  client_id = os.getenv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "")
   # payload = verify_google_token(data.credential, client_id)
    #return google_login(payload["email"], payload.get("name"))

@app.post("/auth/google")
def google_auth_route(data: GoogleAuthRequest, request: Request):
    _check_rate_limit(request.client.host)
    client_id = os.getenv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "")
    payload = verify_google_token(data.credential, client_id)
    return google_login(payload["email"], payload.get("name"))

@app.post("/auth/pro-waitlist")
def pro_waitlist_route(data: WaitlistRequest, request: Request):
    _check_rate_limit(request.client.host)

    token = request.headers.get("Authorization", "")
    user_id = None
    name = None

    if token.startswith("Bearer "):
        token_str = token.split(" ")[1]
        try:
            payload = jwt.decode(token_str, SECRET_KEY, algorithms=["HS256"])
            user = get_user_by_id(payload["user_id"])
            user_id = user["user_id"]
            name = user.get("name")
        except (jwt.InvalidTokenError, HTTPException):
            user_id = None
            name = None

    return join_pro_waitlist(data.email, user_id=user_id, name=name)

@app.post("/auth/forgot-password")
def forgot_password_route(data: ForgotPasswordRequest, request: Request):
    _check_rate_limit(request.client.host)
    return forgot_password(data.email)

@app.post("/auth/reset-password")
def reset_password_route(data: ResetPasswordRequest):
    return reset_password(data.token, data.new_password)

@app.get("/auth/session")
def session_route(request: Request):
    token = request.headers.get("Authorization")
    if not token or not token.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid token")
    token_str = token.split(" ")[1]
    try:
        payload = jwt.decode(token_str, SECRET_KEY, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    if is_token_blacklisted(token_str):
        raise HTTPException(status_code=401, detail="Token has been revoked")

    return get_user_by_id(payload["user_id"])

@app.post("/auth/logout")
def logout_route(request: Request):
    token = request.headers.get("Authorization", "")
    if token.startswith("Bearer "):
        token_str = token.split(" ")[1]
        try:
            payload = jwt.decode(token_str, SECRET_KEY, algorithms=["HS256"])
            expires_at = datetime.utcfromtimestamp(payload["exp"])
            blacklist_token(token_str, expires_at)
        except jwt.InvalidTokenError:
            pass
    return {"message": "Logged out"}

@app.post("/auth/refresh")
def refresh_route(request: Request):
    token = request.headers.get("Authorization", "")
    if not token.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid token")
    token_str = token.split(" ")[1]
    try:
        payload = jwt.decode(token_str, SECRET_KEY, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    if is_token_blacklisted(token_str):
        raise HTTPException(status_code=401, detail="Token has been revoked")
    new_token = jwt.encode(
        {"user_id": payload["user_id"], "exp": datetime.utcnow() + timedelta(hours=24)},
        SECRET_KEY,
        algorithm="HS256"
    )
    return {"token": new_token}

from pipeline.trim_clip import trim_clip
import subprocess

@app.post("/api/trim/{clip_index}")
async def trim_clip_endpoint(
    clip_index: int,
    job_dir: str = Form(...),
    start: float = Form(...),
    end: float = Form(...),
):
    if end <= start:
        raise HTTPException(status_code=400, detail="End time must be greater than start time")

    job_path = resolve_job_dir(job_dir)

    # Trim the raw clip as the source-of-truth.
    # If a captioned clip exists, also trim it to keep the dashboard consistent.
    raw = os.path.join(job_path, "clips", f"clip_{clip_index}.mp4")
    captioned = os.path.join(job_path, "captioned", f"clip_{clip_index}_captioned.mp4")

    if not os.path.isfile(raw):
        raise HTTPException(status_code=404, detail="Clip not found")

    def _trim_in_place(path: str) -> None:
        tmp = path.replace(".mp4", "_trimming.mp4")
        try:
            trim_clip(path, tmp, start, end)
            os.replace(tmp, path)  # atomic replace
        finally:
            if os.path.exists(tmp):
                try:
                    os.remove(tmp)
                except OSError:
                    pass

    trimmed = []
    try:
        _trim_in_place(raw)
        trimmed.append("raw")
        if os.path.isfile(captioned):
            _trim_in_place(captioned)
            trimmed.append("captioned")
    except subprocess.CalledProcessError:
        raise HTTPException(status_code=500, detail="Trim failed")

    # Update captions.json for this clip so re-burning captions stays aligned after trimming.
    captions_file = os.path.join(job_path, "captions.json")
    if os.path.isfile(captions_file):
        try:
            with open(captions_file, "r", encoding="utf-8") as f:
                captions_data = json.load(f)
            if isinstance(captions_data, list):
                for item in captions_data:
                    if int(item.get("highlight_id", -1)) != int(clip_index):
                        continue
                    old_clip_start = float(item.get("clip_start", 0.0) or 0.0)
                    item["clip_start"] = round(old_clip_start + float(start), 3)
                    item["clip_end"] = round(old_clip_start + float(end), 3)

                    words = item.get("words") or []
                    if isinstance(words, list):
                        next_words = []
                        for w in words:
                            try:
                                t = float(w.get("time", 0.0))
                            except Exception:
                                continue
                            if t < float(start) or t > float(end):
                                continue
                            next_words.append({"word": w.get("word", ""), "time": round(t - float(start), 3)})
                        item["words"] = next_words
                    break
                with open(captions_file, "w", encoding="utf-8") as f:
                    json.dump(captions_data, f, indent=2)
        except Exception:
            # Non-fatal: trimming should still succeed even if captions metadata can't be updated.
            pass

    return {
        "status": "ok",
        "clip_index": clip_index,
        "start": start,
        "end": end,
        "job_dir": os.path.basename(job_path),
        "trimmed": trimmed,
    }


@app.post("/api/captions/{job_ref}")
async def update_captions(
    job_ref: str,
    caption_enabled: bool = Form(True),
    caption_style: str = Form("bold_impact"),
    caption_position: str = Form("middle"),
    aspect_ratio: str = Form("9:16"),
    caption_font_scale: float = Form(1.0),
):
    if aspect_ratio not in VALID_ASPECT_RATIOS:
        raise HTTPException(status_code=400, detail="Unsupported aspect ratio. Use 9:16 or 16:9.")

    job_path = resolve_job_dir(job_ref)
    captions_file = os.path.join(job_path, "captions.json")
    clips_dir = os.path.join(job_path, "clips")
    captioned_dir = os.path.join(job_path, "captioned")

    if not os.path.isfile(captions_file):
        raise HTTPException(status_code=404, detail="Captions metadata not found")
    if not os.path.isdir(clips_dir):
        raise HTTPException(status_code=404, detail="Generated clips not found")

    os.makedirs(captioned_dir, exist_ok=True)
    for entry in os.listdir(captioned_dir):
        if not (entry.endswith(".mp4") or entry.endswith(".ass")):
            continue
        try:
            os.remove(os.path.join(captioned_dir, entry))
        except OSError:
            pass

    if caption_enabled:
        burn_captions(
            captions_file,
            clips_dir=clips_dir,
            output_dir=captioned_dir,
            style_name=caption_style,
            position=caption_position,
            aspect_ratio=aspect_ratio,
            font_scale=caption_font_scale,
        )

    resolved_job_dir = os.path.basename(job_path)
    for job in jobs.values():
        if job.get("job_dir") == resolved_job_dir:
            job["caption_enabled"] = caption_enabled
            job["caption_style"] = caption_style
            job["caption_position"] = caption_position
            job["aspect_ratio"] = aspect_ratio
            break

    return {
        "status": "ok",
        "job_dir": resolved_job_dir,
        "caption_enabled": caption_enabled,
        "caption_style": caption_style,
        "caption_position": caption_position,
        "aspect_ratio": aspect_ratio,
    }


@app.post("/api/captions/{job_ref}/{clip_index}")
async def update_single_clip_captions(
    job_ref: str,
    clip_index: int,
    caption_enabled: bool = Form(True),
    caption_style: str = Form("bold_impact"),
    caption_position: str = Form("middle"),
    aspect_ratio: str = Form("9:16"),
    caption_font_scale: float = Form(1.0),
    words: str | None = Form(None),
):
    if aspect_ratio not in VALID_ASPECT_RATIOS:
        raise HTTPException(status_code=400, detail="Unsupported aspect ratio. Use 9:16 or 16:9.")

    job_path = resolve_job_dir(job_ref)
    captions_file = os.path.join(job_path, "captions.json")
    clips_dir = os.path.join(job_path, "clips")
    captioned_dir = os.path.join(job_path, "captioned")
    captioned_clip = os.path.join(captioned_dir, f"clip_{clip_index}_captioned.mp4")
    ass_file = os.path.join(captioned_dir, f"clip_{clip_index}.ass")

    if not os.path.isfile(captions_file):
        raise HTTPException(status_code=404, detail="Captions metadata not found")
    if not os.path.isdir(clips_dir):
        raise HTTPException(status_code=404, detail="Generated clips not found")
    if not os.path.isfile(os.path.join(clips_dir, f"clip_{clip_index}.mp4")):
        raise HTTPException(status_code=404, detail="Clip not found")

    os.makedirs(captioned_dir, exist_ok=True)
    for path in (captioned_clip, ass_file):
        if os.path.exists(path):
            try:
                os.remove(path)
            except OSError:
                pass

    if words is not None:
        try:
            parsed_words = json.loads(words)
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=400, detail=f"Invalid words payload: {exc}") from exc

        if not isinstance(parsed_words, list):
            raise HTTPException(status_code=400, detail="Words payload must be a list")

        try:
            with open(captions_file, "r", encoding="utf-8") as f:
                captions_data = json.load(f)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Failed to read captions metadata: {exc}") from exc

        updated = False
        for item in captions_data if isinstance(captions_data, list) else []:
            if int(item.get("highlight_id", -1)) != int(clip_index):
                continue
            item["words"] = [
                {
                    "word": str(word.get("word", "")),
                    "time": float(word.get("time", 0.0)),
                }
                for word in parsed_words
                if isinstance(word, dict)
            ]
            updated = True
            break

        if not updated:
            raise HTTPException(status_code=404, detail="Clip captions not found")

        try:
            with open(captions_file, "w", encoding="utf-8") as f:
                json.dump(captions_data, f, indent=2)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Failed to update captions metadata: {exc}") from exc

    if caption_enabled:
        burn_captions(
            captions_file,
            clips_dir=clips_dir,
            output_dir=captioned_dir,
            style_name=caption_style,
            position=caption_position,
            aspect_ratio=aspect_ratio,
            clip_ids=[clip_index],
            font_scale=caption_font_scale,
        )

    return {
        "status": "ok",
        "job_dir": os.path.basename(job_path),
        "clip_index": clip_index,
        "caption_enabled": caption_enabled,
        "caption_style": caption_style,
        "caption_position": caption_position,
        "aspect_ratio": aspect_ratio,
        "caption_font_scale": caption_font_scale,
    }


@app.get("/api/captions/{job_ref}/{clip_index}/words")
async def get_single_clip_caption_words(job_ref: str, clip_index: int):
    """
    Return the per-clip caption word timing list used to burn captions.

    The file is generated as <job>/captions.json and has one entry per highlight_id.
    """
    job_path = resolve_job_dir(job_ref)
    captions_file = os.path.join(job_path, "captions.json")
    if not os.path.isfile(captions_file):
        raise HTTPException(status_code=404, detail="Captions metadata not found")

    try:
        with open(captions_file, "r", encoding="utf-8") as f:
            captions_data = json.load(f)
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to read captions metadata")

    for item in captions_data if isinstance(captions_data, list) else []:
        if int(item.get("highlight_id", -1)) == int(clip_index):
            return {
                "job_dir": os.path.basename(job_path),
                "clip_index": int(clip_index),
                "clip_start": item.get("clip_start"),
                "clip_end": item.get("clip_end"),
                "words": item.get("words", []),
            }

    raise HTTPException(status_code=404, detail="Clip captions not found")


class HashtagRequest(BaseModel):
    sport: str
    topic: str = ""
    highlights: list = []


@app.post("/api/generate-hashtags")
async def generate_hashtags_endpoint(request: Request, body: HashtagRequest):
    auth_header = request.headers.get("Authorization", "")
    token = auth_header.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if is_token_blacklisted(token):
        raise HTTPException(status_code=401, detail="Token revoked")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user_id = payload.get("user_id")
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not ALLOW_DEV_PRO_ACCESS and user.get("plan") != "pro":
        raise HTTPException(status_code=403, detail="Pro plan required")

    try:
        tags = generate_hashtags_with_llm(
            sport=body.sport,
            topic=body.topic,
            highlights=body.highlights,
        )
        return {"hashtags": tags}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
