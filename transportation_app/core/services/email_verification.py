import hashlib
import hmac
import secrets
import string

from django.conf import settings
from django.contrib.auth.hashers import check_password


_HMAC_PREFIX = 'hmac-sha256$'


def generate_verification_code() -> str:
    return ''.join(secrets.choice(string.digits) for _ in range(6))


def hash_verification_code(user_id: int, code: str) -> str:
    message = f'{user_id}:{code}'.encode()
    digest = hmac.new(
        settings.SECRET_KEY.encode(),
        message,
        hashlib.sha256,
    ).hexdigest()
    return f'{_HMAC_PREFIX}{digest}'


def check_verification_code(user_id: int, code: str, encoded: str) -> bool:
    if encoded.startswith(_HMAC_PREFIX):
        expected = hash_verification_code(user_id, code)
        return hmac.compare_digest(encoded, expected)
    return check_password(code, encoded)
