from fastapi import FastAPI, UploadFile, File
import uuid
import subprocess
import shutil
import os

app = FastAPI()

UPLOAD_DIR = "storage/videos/"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.post("/upload")
async def upload_video(file: UploadFile = File(...)):

    # Validate extension
    allowed = ["mp4", "mov", "mkv"]
    ext = file.filename.split(".")[-1].lower()

    if ext not in allowed:
        return {"error": "Unsupported file type"}

    # Generate video ID
    video_id = str(uuid.uuid4())

    filepath = f"{UPLOAD_DIR}{video_id}.{ext}"

    # Save file
    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Extract duration using ffprobe
    cmd = [
        "ffprobe",
        "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        filepath
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)

    try:
        duration = int(float(result.stdout.strip()))
    except:
        duration = 0

    return {
        "video_id": video_id,
        "duration": duration
    }

@app.get("/")
def home():
    return {"message": "Video Upload API running"}