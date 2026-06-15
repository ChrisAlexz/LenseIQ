from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
import json
import os
import traceback

router = APIRouter(prefix="/api/captions", tags=["Clips & Captions"])

class WordEntry(BaseModel):
    word: str
    time: float

class HighlightCaption(BaseModel):
    highlight_id: int
    clip_start: float
    clip_end: float
    words: List[WordEntry]

def get_job_path(job_ref: str):
    # Go up TWO levels (from caption folder to project root) to find outputs
    base_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "outputs"))
    job_path = os.path.join(base_path, job_ref)
    if not os.path.isdir(job_path):
        raise HTTPException(status_code=404, detail=f"Job directory not found at {job_path}")
    return job_path

@router.get("/{job_ref}", response_model=List[HighlightCaption])
async def get_captions(job_ref: str):
    job_path = get_job_path(job_ref)
    captions_file = os.path.join(job_path, "captions.json")
    
    if not os.path.exists(captions_file):
        raise HTTPException(status_code=404, detail="Captions file not found.")
    
    with open(captions_file, "r", encoding="utf-8") as f:
        return json.load(f)

@router.post("/{job_ref}/update")
async def update_captions(job_ref: str, updated_data: List[HighlightCaption]):
    try:
        job_path = get_job_path(job_ref)
        captions_file = os.path.join(job_path, "captions.json")

        # Convert Pydantic models to dicts
        data_to_save = [item.dict() for item in updated_data]
        
        with open(captions_file, "w", encoding="utf-8") as f:
            json.dump(data_to_save, f, indent=2)
        
        return {"status": "ok", "message": "Captions updated successfully"}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))