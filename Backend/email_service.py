"""
Florix AI — Enterprise Email & Notification Service
Supports Resend API, Standard SMTP / Gmail SMTP SSL/TLS, and graceful local fallbacks.
Author: Ganesh (Lead Architect)
"""

import os
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional, Tuple
import requests

logger = logging.getLogger("florix.email")


class EmailService:
    """Dispatches transactional emails via Resend API or SMTP with fallbacks."""

    @classmethod
    def send_email(cls, to_email: str, subject: str, html_content: str, text_content: Optional[str] = None) -> Tuple[bool, str]:
        """
        Sends an email using the best available configured provider:
        1. Resend API (if RESEND_API_KEY is configured)
        2. SMTP / Gmail (if SMTP_USER or GMAIL_USER is configured)
        3. Returns (False, reason) if no provider is configured or all fail.
        """
        to_email = to_email.strip()
        if not to_email:
            return False, "Recipient email address is empty"

        # ── 1. Try Resend API ──
        resend_api_key = os.getenv("RESEND_API_KEY")
        if resend_api_key and not resend_api_key.startswith("re_REPLACE"):
            success, msg = cls._send_via_resend(resend_api_key, to_email, subject, html_content)
            if success:
                return True, msg
            logger.warning(f"⚠️ Resend delivery failed: {msg}. Falling back to SMTP if configured...")

        # ── 2. Try SMTP / Gmail ──
        smtp_user = os.getenv("SMTP_USER") or os.getenv("GMAIL_USER") or os.getenv("EMAIL_USER")
        smtp_pass = os.getenv("SMTP_PASSWORD") or os.getenv("GMAIL_APP_PASSWORD") or os.getenv("EMAIL_PASSWORD")
        smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com" if "gmail" in (smtp_user or "").lower() else "smtp.resend.com")
        smtp_port = int(os.getenv("SMTP_PORT", "465"))

        if smtp_user and smtp_pass:
            success, msg = cls._send_via_smtp(
                host=smtp_host,
                port=smtp_port,
                user=smtp_user,
                password=smtp_pass,
                to_email=to_email,
                subject=subject,
                html_content=html_content,
                text_content=text_content
            )
            if success:
                return True, msg
            logger.warning(f"⚠️ SMTP delivery failed: {msg}")

        # ── 3. No active provider available ──
        reason = "No active email provider configured (Set RESEND_API_KEY or SMTP_USER/SMTP_PASSWORD in environment)"
        logger.info(f"ℹ️ {reason}. Email to {to_email} will be handled in instant-token fallback mode.")
        return False, reason

    @classmethod
    def _send_via_resend(cls, api_key: str, to_email: str, subject: str, html_content: str) -> Tuple[bool, str]:
        sender = os.getenv("EMAIL_FROM", "Florix AI <noreply@florix.ai>")
        try:
            resp = requests.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "from": sender,
                    "to": [to_email],
                    "subject": subject,
                    "html": html_content
                },
                timeout=10
            )
            if resp.status_code in [200, 201]:
                logger.info(f"✅ Resend email delivered to {to_email}")
                return True, "Email sent via Resend API"
            else:
                return False, f"Resend API error {resp.status_code}: {resp.text}"
        except Exception as e:
            return False, f"Resend request exception: {e}"

    @classmethod
    def _send_via_smtp(
        cls,
        host: str,
        port: int,
        user: str,
        password: str,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None
    ) -> Tuple[bool, str]:
        sender = os.getenv("EMAIL_FROM", f"Florix AI <{user}>")
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = sender
        msg["To"] = to_email

        if text_content:
            msg.attach(MIMEText(text_content, "plain", "utf-8"))
        msg.attach(MIMEText(html_content, "html", "utf-8"))

        try:
            if port == 465:
                # SSL
                with smtplib.SMTP_SSL(host, port, timeout=12) as server:
                    server.login(user, password)
                    server.sendmail(user, [to_email], msg.as_string())
            else:
                # STARTTLS (e.g. port 587)
                with smtplib.SMTP(host, port, timeout=12) as server:
                    server.starttls()
                    server.login(user, password)
                    server.sendmail(user, [to_email], msg.as_string())

            logger.info(f"✅ SMTP email successfully sent to {to_email} via {host}:{port}")
            return True, "Email sent via SMTP"
        except Exception as e:
            return False, f"SMTP delivery failed: {e}"


def build_password_reset_email_html(reset_link: str, token: str, expiry_hours: int = 1) -> str:
    """Builds a responsive, accessible HTML template for password reset."""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Reset Your Florix AI Password</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0c16; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f1f5f9;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="min-height: 100vh; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 520px; background: #131525; border: 1px solid rgba(255,255,255,0.12); border-radius: 24px; padding: 36px 32px; box-shadow: 0 20px 50px rgba(0,0,0,0.5);">
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <div style="display: inline-block; padding: 12px 20px; background: rgba(99,102,241,0.15); border: 1px solid rgba(99,102,241,0.3); border-radius: 16px; color: #818cf8; font-weight: 800; font-size: 18px; letter-spacing: 0.5px;">
                ⚡ Florix AI
              </div>
            </td>
          </tr>
          <tr>
            <td>
              <h1 style="color: #ffffff; font-size: 22px; font-weight: 800; margin: 0 0 12px 0; text-align: center;">Reset Your Password</h1>
              <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 24px 0; text-align: center;">
                We received a request to reset the password for your Florix AI account. Click the button below to choose a new password:
              </p>
              <div style="text-align: center; margin: 28px 0;">
                <a href="{reset_link}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 14px; box-shadow: 0 10px 25px rgba(99,102,241,0.35);">
                  Reset Password Now →
                </a>
              </div>
              <p style="color: #64748b; font-size: 12px; line-height: 1.5; margin: 20px 0 0 0; text-align: center;">
                If the button above does not work, copy and paste this link into your browser:<br/>
                <a href="{reset_link}" style="color: #818cf8; word-break: break-all; font-size: 11px;">{reset_link}</a>
              </p>
              <div style="margin: 24px 0 0 0; padding: 16px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; text-align: center;">
                <span style="color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 700; letter-spacing: 1px;">Manual Verification Token</span>
                <div style="font-family: monospace; font-size: 15px; color: #e2e8f0; font-weight: 700; margin-top: 6px; letter-spacing: 1.5px; word-break: break-all;">
                  {token}
                </div>
              </div>
              <p style="color: #475569; font-size: 11px; margin: 24px 0 0 0; text-align: center;">
                This link will expire in {expiry_hours} hour. If you did not request this reset, you can safely ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""
