import resend
import logging
from django.conf import settings

logger = logging.getLogger(__name__)


def send_email(to: str, subject: str, html: str, text: str = '') -> bool:
    try:
        resend.api_key = settings.RESEND_API_KEY
        resend.Emails.send({
            "from": "AquaTrack <onboarding@resend.dev>",
            "to": [to],
            "subject": subject,
            "html": html,
            "text": text or subject,
        })
        return True
    except Exception as exc:
        logger.error("Failed to send email to %s: %s", to, exc)
        return False
