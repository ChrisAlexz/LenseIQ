import bcrypt
import jwt
import os
import re
import json
import urllib.request
import urllib.parse
import uuid
from datetime import datetime, timedelta

from fastapi import HTTPException
from psycopg2 import IntegrityError

from auth.database import get_connection
from auth.email_utils import send_verification_email, send_reset_email, send_pro_waitlist_email

SECRET_KEY = os.getenv("SECRET_KEY")


def blacklist_token(token: str, expires_at: datetime):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO token_blacklist (token, expires_at) VALUES (%s, %s) ON CONFLICT DO NOTHING;",
            (token, expires_at),
        )
        conn.commit()
    finally:
        cursor.close()
        conn.close()


def is_token_blacklisted(token: str) -> bool:
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "SELECT 1 FROM token_blacklist WHERE token = %s AND expires_at > NOW();",
            (token,),
        )
        return cursor.fetchone() is not None
    finally:
        cursor.close()
        conn.close()


def _validate_email(email: str):
    if not email or not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", email):
        raise HTTPException(status_code=422, detail="Invalid email address.")


def _validate_password(password: str):
    if not password or len(password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters.")


def join_pro_waitlist(email: str, user_id: int | None = None, name: str | None = None):
    _validate_email(email)

    conn = get_connection()
    cursor = conn.cursor()

    try:
        conn.autocommit = False

        matched_user_id = user_id
        matched_name = name

        if matched_user_id:
            cursor.execute("SELECT id, name FROM users WHERE id = %s;", (matched_user_id,))
            user_row = cursor.fetchone()
            if user_row:
                matched_user_id = user_row[0]
                matched_name = matched_name or user_row[1]
        else:
            cursor.execute("SELECT id, name FROM users WHERE email = %s;", (email,))
            user_row = cursor.fetchone()
            if user_row:
                matched_user_id = user_row[0]
                matched_name = matched_name or user_row[1]

        cursor.execute(
            """
            INSERT INTO pro_waitlist (user_id, name, email)
            VALUES (%s, %s, %s)
            ON CONFLICT (email)
            DO UPDATE SET
                user_id = COALESCE(EXCLUDED.user_id, pro_waitlist.user_id),
                name = COALESCE(EXCLUDED.name, pro_waitlist.name)
            RETURNING id;
            """,
            (matched_user_id, matched_name, email),
        )
        waitlist_id = cursor.fetchone()[0]

        if matched_user_id:
            cursor.execute(
                """
                UPDATE users
                SET pro_waitlist_joined_at = COALESCE(pro_waitlist_joined_at, NOW())
                WHERE id = %s;
                """,
                (matched_user_id,),
            )

        try:
            send_pro_waitlist_email(email)
        except Exception as e:
            conn.rollback()
            raise HTTPException(
                status_code=503,
                detail=f"Could not send waitlist email. Signup not completed. ({e})",
            )

        conn.commit()
        return {"waitlist_id": waitlist_id, "message": "Joined waitlist successfully."}
    finally:
        cursor.close()
        conn.close()


def signup(email, password, name=None):
    """
    Signup requires a verification email to be successfully sent.

    If SMTP is misconfigured or sending fails, this endpoint will:
      - rollback the DB transaction
      - return 503
      - NOT create/update the user record
    """
    _validate_email(email)
    _validate_password(password)

    conn = get_connection()
    cursor = conn.cursor()

    password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    verification_token = str(uuid.uuid4())
    expires_at = datetime.utcnow() + timedelta(hours=24)

    try:
        conn.autocommit = False

        cursor.execute("SELECT id, is_verified FROM users WHERE email = %s;", (email,))
        existing_user = cursor.fetchone()

        if existing_user and existing_user[1] is True:
            raise HTTPException(status_code=409, detail="Account already verified. Please login.")

        if existing_user and existing_user[1] is False:
            cursor.execute(
                """
                UPDATE users
                SET name = %s,
                    password_hash = %s,
                    verification_token = %s,
                    verification_token_expires_at = %s
                WHERE email = %s
                RETURNING id;
                """,
                (name, password_hash, verification_token, expires_at, email),
            )
            user_id = cursor.fetchone()[0]

            try:
                send_verification_email(email, verification_token)
            except Exception as e:
                conn.rollback()
                raise HTTPException(
                    status_code=503,
                    detail=f"Could not send verification email. Signup not completed. ({e})",
                )

            conn.commit()
            return {
                "user_id": user_id,
                "message": "Account already exists but not verified. Verification email resent.",
            }

        cursor.execute(
            """
            INSERT INTO users (
                name, email, password_hash,
                verification_token, verification_token_expires_at, is_verified
            )
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id;
            """,
            (name, email, password_hash, verification_token, expires_at, False),
        )
        user_id = cursor.fetchone()[0]

        try:
            send_verification_email(email, verification_token)
        except Exception as e:
            conn.rollback()
            raise HTTPException(
                status_code=503,
                detail=f"Could not send verification email. Signup not completed. ({e})",
            )

        conn.commit()
        return {"user_id": user_id, "message": "Account created. Please check your email."}

    finally:
        cursor.close()
        conn.close()


def get_user_by_id(user_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, email, name, plan, uploads_today FROM users WHERE id = %s;", (user_id,))
    user = cursor.fetchone()
    cursor.close()
    conn.close()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return {"user_id": user[0], "email": user[1], "name": user[2], "plan": user[3], "uploads_today": user[4]}


def login(email, password):
    if not email or not password:
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, password_hash, is_verified, plan FROM users WHERE email = %s;",
        (email,),
    )
    user = cursor.fetchone()
    cursor.close()
    conn.close()
    # user[1] (password_hash) is None for Google-only accounts, reject those too
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    if not user[2]:
        raise HTTPException(status_code=403, detail="Please verify your email first.")
    try:
        password_ok = user and user[1] and bcrypt.checkpw(password.encode("utf-8"), user[1].encode("utf-8"))
    except (ValueError, TypeError):
        password_ok = False
    if not password_ok:
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    token = jwt.encode(
        {"user_id": user[0], "exp": datetime.utcnow() + timedelta(hours=24)},
        SECRET_KEY,
        algorithm="HS256",
    )
    return {"token": token, "user_id": user[0], "plan": user[3]}


def verify_email(token: str):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            """
            SELECT id, verification_token, verification_token_expires_at
            FROM users
            WHERE verification_token = %s;
            """,
            (token,),
        )

        user = cursor.fetchone()

        if not user:
            raise HTTPException(status_code=400, detail="Token not found")

        user_id, _db_token, expires_at = user

        if expires_at and expires_at < datetime.utcnow():
            raise HTTPException(status_code=400, detail="Token expired")

        cursor.execute(
            """
            UPDATE users
            SET is_verified = TRUE,
                verification_token = NULL,
                verification_token_expires_at = NULL
            WHERE id = %s;
            """,
            (user_id,),
        )

        conn.commit()

        return {"message": "Email verified successfully"}

    finally:
        cursor.close()
        conn.close()


def verify_google_token(credential: str, client_id: str) -> dict:
    """Verify a Google ID token via Google's tokeninfo endpoint."""
    url = f"https://oauth2.googleapis.com/tokeninfo?id_token={urllib.parse.quote(credential)}"
    try:
        with urllib.request.urlopen(url, timeout=5) as resp:
            payload = json.loads(resp.read())
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid Google token.")
    if payload.get("aud") != client_id:
        raise HTTPException(status_code=401, detail="Invalid Google token.")
    if payload.get("email_verified") != "true":
        raise HTTPException(status_code=401, detail="Google email not verified.")
    return payload


def forgot_password(email: str):
    _validate_email(email)

    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id FROM users WHERE email = %s AND is_verified = TRUE;", (email,))
        user = cursor.fetchone()

        # Always return success to avoid leaking whether the email exists
        if not user:
            return {"message": "If this email exists, a reset link has been sent."}

        reset_token = str(uuid.uuid4())
        expires_at = datetime.utcnow() + timedelta(hours=1)

        cursor.execute(
            "UPDATE users SET reset_token = %s, reset_token_expires_at = %s WHERE id = %s;",
            (reset_token, expires_at, user[0]),
        )
        conn.commit()

        try:
            send_reset_email(email, reset_token)
        except Exception as e:
            raise HTTPException(status_code=503, detail=f"Could not send reset email. ({e})")

        return {"message": "If this email exists, a reset link has been sent."}
    finally:
        cursor.close()
        conn.close()


def reset_password(token: str, new_password: str):
    _validate_password(new_password)

    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "SELECT id, reset_token_expires_at FROM users WHERE reset_token = %s;",
            (token,),
        )
        user = cursor.fetchone()

        if not user:
            raise HTTPException(status_code=400, detail="Invalid or expired reset link.")

        user_id, expires_at = user

        if not expires_at or expires_at < datetime.utcnow():
            raise HTTPException(status_code=400, detail="Reset link has expired.")

        password_hash = bcrypt.hashpw(new_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

        cursor.execute(
            "UPDATE users SET password_hash = %s, reset_token = NULL, reset_token_expires_at = NULL WHERE id = %s;",
            (password_hash, user_id),
        )
        conn.commit()

        return {"message": "Password updated successfully."}
    finally:
        cursor.close()
        conn.close()


def google_login(email: str, name: str = None):
    """Find or create a user by Google email, then issue an app JWT."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id, name FROM users WHERE email = %s;", (email,))
        user = cursor.fetchone()
        if not user:
            try:
                cursor.execute(
                    "INSERT INTO users (name, email, is_verified) VALUES (%s, %s, TRUE) RETURNING id;",
                    (name, email),
                )
                user = cursor.fetchone()
                conn.commit()
            except IntegrityError:
                # Another request created this user concurrently, re-fetch
                conn.rollback()
                cursor.execute("SELECT id, name FROM users WHERE email = %s;", (email,))
                user = cursor.fetchone()
        else:
            # Update name from Google if the DB doesn't have one yet
            if not user[1] and name:
                cursor.execute("UPDATE users SET name = %s WHERE id = %s;", (name, user[0]))
                conn.commit()
    finally:
        cursor.close()
        conn.close()
    token = jwt.encode(
        {"user_id": user[0], "exp": datetime.utcnow() + timedelta(hours=24)},
        SECRET_KEY,
        algorithm="HS256",
    )
    return {"token": token, "user_id": user[0], "email": email, "name": name}

