# transportation-system

## Django production configuration

The Django application refuses to start with `DEBUG=False` unless its production
security settings are explicit and safe. Configure these values through the
environment or an untracked `.env` file; never commit secrets:

- `DEBUG=False`
- `SECRET_KEY` with at least 50 characters and sufficient randomness
- `ALLOWED_HOSTS` containing the exact hostnames (not `*`)
- `SECURE_SSL_REDIRECT=True`
- `SECURE_HSTS_SECONDS` greater than `0` (only after HTTPS is enabled end to end)
- `SESSION_COOKIE_SECURE=True` and `CSRF_COOKIE_SECURE=True`
- `FRONTEND_BASE_URL` using `https://`
- `EMAIL_URL` configured for a real email service; the development console backend
  is rejected in production
- `CACHE_URL` pointing to a shared cache; local-memory cache is rejected in production

New passenger and driver registrations must verify their email with a six-digit
code before signing in. Codes expire after 10 minutes by default; configure
`EMAIL_VERIFICATION_TIMEOUT` in seconds to change this period. Users can request
a replacement code from the registration screen.

For reverse-proxy deployments, configure Django's trusted HTTPS proxy handling at
the deployment boundary before enabling `SECURE_SSL_REDIRECT`. Apply schema
migrations with `python manage.py migrate` after deploying.