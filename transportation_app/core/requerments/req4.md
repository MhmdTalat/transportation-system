# Secure Password Reset by Email Token — Implementation Requirements

Act as a Senior Full-Stack Engineer specializing in authentication, application security, React, Volt UI, and backend API integration.

Implement a complete **Forgot Password / Reset Password** feature for the existing Transportation Management System.

## 1. Analyze the Existing Project First

Before writing code:

* Inspect the existing React + Volt frontend and backend authentication implementation.
* Identify the authentication framework, user model, email configuration, API routes, and existing password-management functionality.
* Reuse the existing authentication architecture.
* Do not create duplicate user models, authentication systems, or unnecessary endpoints.
* Preserve existing login, registration, role-based authorization, and business logic.
* If the backend does not support password-reset tokens, implement the feature using the existing backend framework and architecture.

## 2. Forgot Password Page

Create a professional Volt-styled page accessible from the login screen through a **Forgot Password?** link.

Include:

* Email input.
* Email validation.
* Submit button.
* Loading indicator.
* Success and error feedback.
* A link to return to login.

Page heading:

**Forgot your password?**

Description:

"Enter your registered email address. If an account exists, we'll send you instructions to reset your password."

After submission, display a generic success message regardless of whether the email exists, preventing account enumeration.

Do not reveal whether a particular email address is registered.

## 3. Generate a Secure Reset Token

When a password-reset request is submitted:

1. Validate the email format.
2. Look up the account without revealing its existence to the requester.
3. Generate a cryptographically secure, unpredictable, single-use reset token.
4. Associate the token with the correct account.
5. Set a configurable expiration time, preferably 15–30 minutes.
6. Store the token securely. Prefer a hash of the token when implementing a custom token mechanism.
7. Send a password-reset email containing a link to the frontend reset page.
8. Never send the user's existing password or store a plaintext reset token unnecessarily.

Use the existing framework's built-in password-reset mechanism when available and appropriate.

## 4. Password Reset Email

Create a professional HTML email consistent with the transportation platform's branding.

Subject:

**Reset Your Transportation Platform Password**

Email content:

* Greeting.
* Explanation that a password-reset request was received.
* A clear **Reset Password** button.
* The expiration period.
* A note that the request can be ignored if it was not initiated by the recipient.

The link should follow this pattern:

`https://your-frontend-domain.com/reset-password?token=<token>`

Configure the frontend base URL using environment variables. Never hardcode production URLs.

Use the existing backend email service and environment-based SMTP credentials. Do not expose email passwords, API keys, or other secrets in React code.

## 5. Reset Password Page

Create a dedicated page that reads the reset token from the URL.

Form fields:

* New password.
* Confirm new password.

Requirements:

* Password visibility toggle.
* Client-side password validation.
* Password confirmation matching.
* Submit button with loading state.
* Clear validation errors.
* Accessible form labels.
* Responsive Volt styling.

Show a password-strength indicator if practical.

Do not treat client-side validation as a replacement for backend validation.

## 6. Validate the Token on the Backend

When the user submits a new password, the backend must verify that:

* The token exists.
* The token belongs to the intended account.
* The token has not expired.
* The token has not already been used.
* The account is eligible for password reset.

If any check fails, reject the request without changing the password.

Show a useful frontend message:

"Your reset link is invalid or has expired. Please request a new one."

Do not trust the email address or account ID supplied by the frontend to determine which account may be modified. Derive the account from the validated token.

## 7. Update the Password Securely

After successful token validation:

1. Validate the password against the backend password policy.
2. Hash the new password using the framework's established password-hashing mechanism.
3. Update the password atomically with token consumption.
4. Invalidate the reset token so it cannot be reused.
5. Invalidate other outstanding reset tokens for that account when appropriate.
6. Revoke existing sessions or refresh tokens when supported and appropriate.
7. Record security-relevant events without logging passwords or raw tokens.

Do not store passwords in plaintext or implement a custom password-hashing algorithm.

## 8. Security Requirements

Implement:

* Rate limiting for password-reset requests.
* Rate limiting for token-validation and password-reset attempts.
* Generic responses that do not disclose account existence.
* Single-use, expiring reset tokens.
* HTTPS-only production reset links.
* CSRF protection where applicable.
* Safe URL construction and validation.
* No password or token leakage through application logs.
* No third-party analytics or referrer leakage from reset-token pages.
* Secure session invalidation where supported.

Do not automatically log the user in after resetting the password unless the existing authentication design explicitly requires it.

## 9. API Integration

Inspect existing routes before creating endpoints. If equivalent functionality does not exist, implement the appropriate API operations, such as:

* `POST /api/auth/forgot-password`
* `POST /api/auth/reset-password`

Use the project's actual API conventions and naming standards.

The React frontend must communicate with the backend through the existing API service layer. Do not implement password-reset logic entirely in React.

Handle network failures, expired tokens, invalid requests, and successful resets consistently.

## 10. Success Flow

After the password is reset successfully:

Display:

**Password Reset Successful**

"Your password has been updated. You can now sign in using your new password."

Provide a button:

**Return to Login**

Ensure the old reset link cannot be reused.

## 11. Testing and Acceptance Criteria

Test all of the following:

* Valid email receives a reset email.
* Unknown email receives the same public response.
* Valid token allows a password reset.
* Expired token is rejected.
* Invalid token is rejected.
* Reused token is rejected.
* Password confirmation mismatch is handled.
* Weak passwords are rejected by the backend.
* Password-reset requests are rate-limited.
* Existing login works with the new password.
* The old password no longer works.
* Existing roles and permissions remain unchanged.
* The frontend works on desktop and mobile.
* Email delivery failures are handled safely.
* No secrets or raw reset tokens appear in logs.

Write automated backend tests and frontend tests where the existing test infrastructure supports them.

## 12. Final Implementation Rules

Read the existing project before making changes. Implement the complete feature, not merely the UI screens.

Preserve existing business logic, use the existing authentication and email architecture, and document any required environment variables and database migrations.

At completion, provide:

1. Files created or modified.
2. API endpoints implemented or reused.
3. Environment variables required.
4. Database migrations, if any.
5. Email setup instructions.
6. Security decisions.
7. Test results and any remaining limitations.

Do not claim the feature is production-ready unless the backend security checks, email delivery configuration, token lifecycle, and relevant tests have been verified.
