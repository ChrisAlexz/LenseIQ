import psycopg2
from dotenv import load_dotenv
from fastapi import HTTPException
import os
from pathlib import Path

ENV_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ENV_ROOT / ".env", override=False)
load_dotenv(ENV_ROOT / ".env.local", override=True)

def get_connection():
    try:
        return psycopg2.connect(
            host=os.getenv("DB_HOST", "localhost"),
            port=int(os.getenv("DB_PORT", "5432")),
            database=os.getenv("DB_NAME"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD")
        )
    except psycopg2.OperationalError:
        raise HTTPException(status_code=503, detail="Database unavailable. Please try again later.")
