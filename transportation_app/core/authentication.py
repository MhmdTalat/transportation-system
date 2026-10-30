from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication


class VerifiedEmailJWTAuthentication(JWTAuthentication):
    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        if not user.email_verified:
            raise AuthenticationFailed(
                {
                    'detail': 'Verify your email address before signing in.',
                    'code': 'email_not_verified',
                },
                code='email_not_verified',
            )
        return user
