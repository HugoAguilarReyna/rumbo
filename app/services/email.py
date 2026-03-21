import aiosmtplib
from email.message import EmailMessage
from app.core.config import settings

async def send_email(subject: str, recipients: list, body: str):
    message = EmailMessage()
    message["From"] = settings.FROM_EMAIL
    message["To"] = ", ".join(recipients)
    message["Subject"] = subject
    message.set_content(body)
    
    if not settings.SMTP_HOST or not settings.SMTP_USER:
        print(f"Mock Email to {recipients}: {subject}\n{body}")
        return

    try:
        await aiosmtplib.send(
            message,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
            use_tls=True,
            timeout=10.0
        )
    except Exception as e:
        print(f"Failed to send email: {e}")
