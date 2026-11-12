import asyncio
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Protocol

from app.core.config import settings

logger = logging.getLogger("app.email")


class EmailServiceProtocol(Protocol):
    async def send_verification_email(
        self, to_email: str, full_name: str, verification_url: str, raw_token: str
    ) -> None: ...

    async def send_password_reset_email(
        self, to_email: str, full_name: str, reset_url: str, raw_token: str
    ) -> None: ...

    async def send_password_reset_otp_email(
        self, to_email: str, full_name: str, otp_code: str
    ) -> None: ...


class EmailService:
    def __init__(self) -> None:
        self.smtp_host = settings.SMTP_HOST
        self.smtp_port = settings.SMTP_PORT
        self.smtp_user = settings.SMTP_USER
        self.smtp_password = settings.SMTP_PASSWORD
        self.smtp_tls = settings.SMTP_TLS
        self.from_email = settings.EMAILS_FROM_EMAIL
        self.from_name = settings.EMAILS_FROM_NAME

    async def _send_via_http_async(
        self, to_email: str, subject: str, text_content: str, html_content: str
    ) -> bool:
        """Attempt email delivery via HTTP REST API (Port 443 HTTPS), completely immune to cloud SMTP port blocking."""
        import httpx

        # 1. Google Apps Script Webhook Relay (sends from user's personal Gmail, 100% free)
        if settings.EMAIL_WEBHOOK_URL:
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.post(
                        settings.EMAIL_WEBHOOK_URL,
                        json={
                            "to": to_email,
                            "subject": subject,
                            "html": html_content,
                            "text": text_content,
                        },
                    )
                    if resp.status_code < 400:
                        logger.info(f"Email delivered to {to_email} via Google Apps Script Webhook Relay.")
                        return True
            except Exception as e:
                logger.warning(f"Google Apps Script Webhook failed: {e}")

        # 2. Brevo HTTP REST API (Free 300 emails/day)
        if settings.BREVO_API_KEY:
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.post(
                        "https://api.brevo.com/v3/smtp/email",
                        headers={"api-key": settings.BREVO_API_KEY, "Content-Type": "application/json"},
                        json={
                            "sender": {"name": self.from_name, "email": self.from_email},
                            "to": [{"email": to_email}],
                            "subject": subject,
                            "htmlContent": html_content,
                        },
                    )
                    if resp.status_code < 400:
                        logger.info(f"Email delivered to {to_email} via Brevo HTTP API.")
                        return True
            except Exception as e:
                logger.warning(f"Brevo HTTP API failed: {e}")

        # 3. Resend HTTP REST API
        if settings.RESEND_API_KEY:
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.post(
                        "https://api.resend.com/emails",
                        headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}", "Content-Type": "application/json"},
                        json={
                            "from": f"{self.from_name} <onboarding@resend.dev>",
                            "to": [to_email],
                            "subject": subject,
                            "html": html_content,
                        },
                    )
                    if resp.status_code < 400:
                        logger.info(f"Email delivered to {to_email} via Resend HTTP API.")
                        return True
            except Exception as e:
                logger.warning(f"Resend HTTP API failed: {e}")

        return False

    def _send_smtp_sync(self, to_email: str, subject: str, text_content: str, html_content: str) -> None:
        if not self.smtp_host:
            logger.info(
                "\n================ [EMAIL SERVICE: DEV LOGGING] ================\n"
                f"To: {to_email}\n"
                f"Subject: {subject}\n"
                f"Body:\n{text_content}\n"
                "=============================================================="
            )
            return

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{self.from_name} <{self.from_email}>"
        msg["To"] = to_email

        part1 = MIMEText(text_content, "plain")
        part2 = MIMEText(html_content, "html")
        msg.attach(part1)
        msg.attach(part2)

        # Primary Attempt: Standard TLS (Port 587 or configured port)
        try:
            with smtplib.SMTP(self.smtp_host, self.smtp_port, timeout=3) as server:
                server.ehlo()
                if self.smtp_tls:
                    server.starttls()
                    server.ehlo()
                if self.smtp_user and self.smtp_password:
                    server.login(self.smtp_user, self.smtp_password)
                server.sendmail(self.from_email, [to_email], msg.as_string())
                logger.info(f"Email successfully delivered to {to_email} via SMTP (port {self.smtp_port}).")
                return
        except Exception as e587:
            logger.warning(
                f"SMTP attempt on port {self.smtp_port} failed: {e587}. Retrying with direct SSL port 465 fallback..."
            )

        # Secondary Attempt: Direct SSL (Port 465) fallback for cloud container environments
        try:
            with smtplib.SMTP_SSL(self.smtp_host, 465, timeout=3) as server:
                if self.smtp_user and self.smtp_password:
                    server.login(self.smtp_user, self.smtp_password)
                server.sendmail(self.from_email, [to_email], msg.as_string())
                logger.info(f"Email successfully delivered to {to_email} via direct SMTP_SSL (port 465).")
                return
        except Exception as e465:
            logger.warning(
                f"[EMAIL NOTICE] Direct SMTP to {to_email} failed: {e465}. "
                "Cloud firewall may be blocking raw SMTP ports (25/465/587). "
                "Email fallback active."
            )
            if "Network is unreachable" in str(e465) or "Errno 101" in str(e465) or "Errno 110" in str(e465):
                return
            raise RuntimeError(f"Failed to deliver email to {to_email}: {e465}") from e465

    async def send_verification_email(
        self, to_email: str, full_name: str, verification_url: str, raw_token: str
    ) -> None:
        subject = f"Verify your {self.from_name} account"
        text_content = (
            f"Hello {full_name},\n\n"
            f"Thank you for registering with {self.from_name}.\n"
            f"Please verify your email address by opening the following link:\n"
            f"{verification_url}\n\n"
            f"Alternatively, enter this verification code directly in the app: {raw_token}\n\n"
            "This link will expire in 24 hours.\n\n"
            "If you did not sign up for StudyMate AI, please ignore this email."
        )
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0d0b1a; color: #f1f5f9; padding: 24px; }}
                .card {{ max-width: 520px; margin: 0 auto; background: #16122d; border-radius: 16px; border: 1px solid #3b2d6a; padding: 32px; text-align: center; }}
                .btn {{ display: inline-block; background: linear-gradient(135deg, #7c3aed, #4f46e5); color: #ffffff !important; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 600; margin: 20px 0; font-size: 16px; }}
                .code-box {{ background: #0d0b1a; border: 1px dashed #7c3aed; border-radius: 8px; padding: 12px; font-family: monospace; font-size: 20px; letter-spacing: 2px; color: #a78bfa; margin: 16px 0; word-break: break-all; }}
                .footer {{ color: #94a3b8; font-size: 12px; margin-top: 24px; }}
            </style>
        </head>
        <body>
            <div class="card">
                <h2 style="color: #ffffff; margin-bottom: 8px;">StudyMate AI</h2>
                <h3 style="color: #c4b5fd; margin-top: 0;">Verify Your Email Address</h3>
                <p>Hello <strong>{full_name}</strong>,</p>
                <p>Thank you for joining StudyMate AI. Tap the button below to verify your email and activate your account:</p>
                <a href="{verification_url}" class="btn">Verify Email Address</a>
                <p style="color: #94a3b8; font-size: 14px;">Or copy and paste this link in your browser:</p>
                <p style="color: #818cf8; font-size: 12px; word-break: break-all;">{verification_url}</p>
                <div class="code-box">{raw_token}</div>
                <p class="footer">This verification link will expire in 24 hours.<br>If you did not create an account, you can safely disregard this email.</p>
            </div>
        </body>
        </html>
        """
        # Try HTTP email relay first (immune to port blocks)
        sent_http = await self._send_via_http_async(to_email, subject, text_content, html_content)
        if sent_http:
            return

        await asyncio.to_thread(self._send_smtp_sync, to_email, subject, text_content, html_content)

    async def send_password_reset_email(
        self, to_email: str, full_name: str, reset_url: str, raw_token: str
    ) -> None:
        subject = f"Reset your {self.from_name} password"
        text_content = (
            f"Hello {full_name},\n\n"
            f"We received a request to reset your password for {self.from_name}.\n"
            f"Use the link below to set a new password:\n"
            f"{reset_url}\n\n"
            f"Reset Token: {raw_token}\n\n"
            "This link will expire in 1 hour.\n\n"
            "If you did not request a password reset, please ignore this email."
        )
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0d0b1a; color: #f1f5f9; padding: 24px; }}
                .card {{ max-width: 520px; margin: 0 auto; background: #16122d; border-radius: 16px; border: 1px solid #3b2d6a; padding: 32px; text-align: center; }}
                .btn {{ display: inline-block; background: linear-gradient(135deg, #ec4899, #8b5cf6); color: #ffffff !important; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 600; margin: 20px 0; font-size: 16px; }}
                .code-box {{ background: #0d0b1a; border: 1px dashed #8b5cf6; border-radius: 8px; padding: 12px; font-family: monospace; font-size: 18px; color: #c084fc; margin: 16px 0; word-break: break-all; }}
                .footer {{ color: #94a3b8; font-size: 12px; margin-top: 24px; }}
            </style>
        </head>
        <body>
            <div class="card">
                <h2 style="color: #ffffff; margin-bottom: 8px;">StudyMate AI</h2>
                <h3 style="color: #f472b6; margin-top: 0;">Password Reset Request</h3>
                <p>Hello <strong>{full_name}</strong>,</p>
                <p>We received a request to reset your password. Tap the button below to choose a new password:</p>
                <a href="{reset_url}" class="btn">Reset Password</a>
                <div class="code-box">{raw_token}</div>
                <p class="footer">This password reset link will expire in 1 hour.<br>If you did not request this, please secure your account immediately.</p>
            </div>
        </body>
        </html>
        """
        # Try HTTP email relay first (immune to port blocks)
        sent_http = await self._send_via_http_async(to_email, subject, text_content, html_content)
        if sent_http:
            return

        await asyncio.to_thread(self._send_smtp_sync, to_email, subject, text_content, html_content)

    async def send_password_reset_otp_email(
        self, to_email: str, full_name: str, otp_code: str
    ) -> None:
        subject = f"{otp_code} is your {self.from_name} password reset code"
        text_content = (
            f"Hello {full_name},\n\n"
            f"Your StudyMate AI password reset verification code is:\n\n"
            f"  {otp_code}\n\n"
            "This 6-digit code will expire in 10 minutes.\n"
            "Enter this code on the Password Recovery screen to set a new password.\n\n"
            "If you did not request this code, you can safely ignore this email. Your password will remain unchanged."
        )
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #070514; color: #f1f5f9; padding: 24px; }}
                .card {{ max-width: 480px; margin: 0 auto; background: #140f2d; border-radius: 20px; border: 1px solid #7c3aed; padding: 32px; text-align: center; }}
                .logo {{ font-size: 24px; font-weight: 800; color: #ffffff; margin-bottom: 4px; }}
                .logo-accent {{ color: #a855f7; }}
                .title {{ color: #f8fafc; font-size: 20px; font-weight: 700; margin-top: 12px; margin-bottom: 8px; }}
                .subtitle {{ color: #94a3b8; font-size: 14px; margin-bottom: 24px; line-height: 1.5; }}
                .otp-box {{ background: linear-gradient(135deg, rgba(124, 58, 237, 0.2), rgba(168, 85, 247, 0.15)); border: 2px dashed #8b5cf6; border-radius: 16px; padding: 18px 24px; font-family: 'Courier New', monospace; font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #c084fc; margin: 24px 0; }}
                .expiry-note {{ color: #f59e0b; font-size: 13px; font-weight: 600; margin-bottom: 20px; }}
                .footer {{ color: #64748b; font-size: 12px; margin-top: 28px; line-height: 1.5; border-top: 1px solid #2e1a56; padding-top: 16px; }}
            </style>
        </head>
        <body>
            <div class="card">
                <div class="logo">StudyMate <span class="logo-accent">AI</span></div>
                <div class="title">Password Reset Code</div>
                <div class="subtitle">Hello <strong>{full_name}</strong>, use the 6-digit verification code below to reset your student account password:</div>
                <div class="otp-box">{otp_code}</div>
                <div class="expiry-note">⏱️ This code will expire in 10 minutes</div>
                <div class="footer">If you did not request a password reset, please ignore this email. Your account remains completely secure.</div>
            </div>
        </body>
        </html>
        """
        # Try HTTP email relay first (immune to port blocks)
        sent_http = await self._send_via_http_async(to_email, subject, text_content, html_content)
        if sent_http:
            return

        await asyncio.to_thread(self._send_smtp_sync, to_email, subject, text_content, html_content)


_email_service_instance: EmailService | None = None


def get_email_service() -> EmailService:
    global _email_service_instance
    if _email_service_instance is None:
        _email_service_instance = EmailService()
    return _email_service_instance

