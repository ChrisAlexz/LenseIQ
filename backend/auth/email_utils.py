import smtplib
import os
from email.mime.text import MIMEText

# Environment configs
FRONTEND_URL = os.getenv("FRONTEND_URL")
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT") or "587")


def send_verification_email(to_email: str, token: str):
    # Read credentials at runtime
    FRONTEND_URL = os.getenv("FRONTEND_URL")

    smtp_email = os.getenv("SMTP_EMAIL") or os.getenv("SMTP_USER")
    smtp_password = os.getenv("SMTP_PASSWORD") or os.getenv("SMTP_PASS")

    if not smtp_email or not smtp_password:
        raise Exception("SMTP credentials not configured")

    verification_link = f"{FRONTEND_URL}/verify?token={token}"

    subject = "Verify your AutoReel account 🎬"

    html_body = f"""
    <html>
      <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px;">
        <div style="max-width: 600px; margin: auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
          
          <h2 style="color: #111; text-align: center;">Welcome to AutoReel 🎬</h2>
          
          <p style="font-size: 16px; color: #555;">
            Thanks for signing up! Please confirm your email address to get started.
          </p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="{verification_link}" 
               style="background-color: #4CAF50; color: white; padding: 14px 25px; text-decoration: none; border-radius: 6px; font-size: 16px; display: inline-block;">
               Verify Account
            </a>
          </div>

          <p style="font-size: 14px; color: #777;">
            Or copy and paste this link into your browser:
          </p>

          <p style="word-break: break-all; font-size: 13px; color: #555;">
            {verification_link}
          </p>

          <hr style="margin: 30px 0;">

          <p style="font-size: 12px; color: #aaa; text-align: center;">
            If you didn’t sign up, you can safely ignore this email.
          </p>

        </div>
      </body>
    </html>
    """

    msg = MIMEText(html_body, "html")
    msg["Subject"] = subject
    msg["From"] = smtp_email
    msg["To"] = to_email

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
            server.starttls()
            server.login(smtp_email, smtp_password)
            server.send_message(msg)

        print(" Email sent successfully")

    except Exception as e:
        print(" Email failed:", str(e))
        raise Exception(f"Email failed: {e}") from e


def send_reset_email(to_email: str, token: str):
    FRONTEND_URL = os.getenv("FRONTEND_URL")

    smtp_email = os.getenv("SMTP_EMAIL") or os.getenv("SMTP_USER")
    smtp_password = os.getenv("SMTP_PASSWORD") or os.getenv("SMTP_PASS")

    if not smtp_email or not smtp_password:
        raise Exception("SMTP credentials not configured")

    reset_link = f"{FRONTEND_URL}/reset-password?token={token}"

    subject = "Reset your AutoReel password"

    html_body = f"""
    <html>
      <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px;">
        <div style="max-width: 600px; margin: auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">

          <h2 style="color: #111; text-align: center;">Reset Your Password</h2>

          <p style="font-size: 16px; color: #555;">
            We received a request to reset your password. Click the button below to choose a new one.
          </p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="{reset_link}"
               style="background-color: #2563EB; color: white; padding: 14px 25px; text-decoration: none; border-radius: 6px; font-size: 16px; display: inline-block;">
               Reset Password
            </a>
          </div>

          <p style="font-size: 14px; color: #777;">
            Or copy and paste this link into your browser:
          </p>

          <p style="word-break: break-all; font-size: 13px; color: #555;">
            {reset_link}
          </p>

          <hr style="margin: 30px 0;">

          <p style="font-size: 12px; color: #aaa; text-align: center;">
            This link expires in 1 hour. If you didn't request this, you can safely ignore this email.
          </p>

        </div>
      </body>
    </html>
    """

    msg = MIMEText(html_body, "html")
    msg["Subject"] = subject
    msg["From"] = smtp_email
    msg["To"] = to_email

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
            server.starttls()
            server.login(smtp_email, smtp_password)
            server.send_message(msg)

        print(" Reset email sent successfully")

    except Exception as e:
        print(" Reset email failed:", str(e))
        raise Exception(f"Reset email failed: {e}") from e


def send_pro_waitlist_email(to_email: str):
    smtp_email = os.getenv("SMTP_EMAIL") or os.getenv("SMTP_USER")
    smtp_password = os.getenv("SMTP_PASSWORD") or os.getenv("SMTP_PASS")

    if not smtp_email or not smtp_password:
        raise Exception("SMTP credentials not configured")

    subject = "Thanks for joining the LENSEIQ Pro waitlist"

    html_body = """
    <html>
      <body style="font-family: Arial, sans-serif; background-color: #f4f4f5; padding: 20px;">
        <div style="max-width: 600px; margin: auto; background: white; padding: 32px; border-radius: 14px; border: 1px solid #e5e7eb;">
          <h2 style="color: #111827; margin: 0 0 16px;">You're on the LENSEIQ Pro waitlist</h2>
          <p style="font-size: 15px; color: #4b5563; line-height: 1.7; margin: 0 0 14px;">
            Thanks for joining the waitlist for our Pro model.
          </p>
          <p style="font-size: 15px; color: #4b5563; line-height: 1.7; margin: 0 0 14px;">
            We'll keep you posted about updates on our Pro model.
          </p>
          <p style="font-size: 14px; color: #6b7280; margin: 20px 0 0;">
            — LENSEIQ
          </p>
        </div>
      </body>
    </html>
    """

    msg = MIMEText(html_body, "html")
    msg["Subject"] = subject
    msg["From"] = smtp_email
    msg["To"] = to_email

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
            server.starttls()
            server.login(smtp_email, smtp_password)
            server.send_message(msg)
    except Exception as e:
        print(" Waitlist email failed:", str(e))
        raise Exception(f"Email failed: {e}") from e
