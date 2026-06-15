from fastapi import APIRouter, Depends
from pydantic import BaseModel
from datetime import datetime, timedelta
import jwt
import os
from fastapi import APIRouter, Depends, HTTPException
from auth.auth import (
    signup,
    login,
    get_user_by_id,
    verify_email,
    blacklist_token
)

from auth.deps import get_current_user
from auth.auth import forgot_password, reset_password
router = APIRouter(prefix="/auth")


class SignupRequest(BaseModel):
    email: str
    password: str
    name: str | None = None


class LoginRequest(BaseModel):
    email: str
    password: str


class VerifyEmailRequest(BaseModel):
    token: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

@router.post("/signup")
def signup_route(data: SignupRequest):
    return signup(data.email, data.password, data.name)


@router.post("/login")
def login_route(data: LoginRequest):
    return login(data.email, data.password)


@router.get("/auth/verify")
def verify_email_route(token: str):
    return verify_email(token)


@router.get("/me")
def get_me(user=Depends(get_current_user)):
    return get_user_by_id(user["user_id"])


@router.post("/logout")
def logout(user=Depends(get_current_user)):
    token = user["token"]
    SECRET_KEY = os.getenv("SECRET_KEY")

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        expires_at = datetime.utcfromtimestamp(payload["exp"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    blacklist_token(token, expires_at)

    return {"message": "Logged out successfully"}


@router.post("/forgot-password")
def forgot_password_route(data: ForgotPasswordRequest):
    return forgot_password(data.email)

@router.post("/reset-password")
def reset_password_route(data: ResetPasswordRequest):
    return reset_password(data.token, data.new_password)