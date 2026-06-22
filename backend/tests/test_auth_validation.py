"""Tests for the pure validation helpers in auth/auth.py — no DB/network needed."""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from fastapi import HTTPException
from auth.auth import _validate_email, _validate_password


def test_validate_email_accepts_valid_address():
    _validate_email("someone@example.com")  # should not raise


def test_validate_email_rejects_missing_at_sign():
    with pytest.raises(HTTPException) as exc_info:
        _validate_email("not-an-email")
    assert exc_info.value.status_code == 422


def test_validate_email_rejects_empty_string():
    with pytest.raises(HTTPException):
        _validate_email("")


def test_validate_password_accepts_eight_or_more_chars():
    _validate_password("longenough")  # should not raise


def test_validate_password_rejects_short_password():
    with pytest.raises(HTTPException) as exc_info:
        _validate_password("short")
    assert exc_info.value.status_code == 422


def test_validate_password_rejects_empty_string():
    with pytest.raises(HTTPException):
        _validate_password("")
