from smtplib import (
    SMTPAuthenticationError,
    SMTPConnectError,
    SMTPException,
    SMTPRecipientsRefused,
    SMTPSenderRefused,
    SMTPServerDisconnected,
)

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.core.mail.exceptions import InvalidMailer
from django.core.management.base import BaseCommand, CommandError
from django.core.validators import validate_email
from django.core.exceptions import ValidationError


class Command(BaseCommand):
    help = 'Send a test message using the configured SMTP email backend.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--recipient',
            required=True,
            help='Email address that should receive the test message.',
        )

    def handle(self, *args, **options):
        recipient = options['recipient']
        try:
            validate_email(recipient)
        except ValidationError as error:
            raise CommandError('The recipient must be a valid email address.') from error

        mailer = settings.MAILERS['default']
        backend = mailer['BACKEND']
        if not backend.endswith('.smtp.EmailBackend'):
            raise CommandError(
                f'The configured email backend is {backend}, not SMTP. '
                'Set EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend '
                'and configure Gmail credentials before running this command.'
            )
        mail_options = mailer['OPTIONS']
        if not mail_options.get('username') or not mail_options.get('password'):
            raise CommandError(
                'EMAIL_HOST_USER and EMAIL_HOST_PASSWORD must be configured '
                'before sending a test email.'
            )
        sender = settings.DEFAULT_FROM_EMAIL
        if (
            not sender
            or '@' not in sender
            or sender.casefold().endswith('@localhost')
        ):
            raise CommandError(
                'DEFAULT_FROM_EMAIL must be the authenticated Gmail address '
                'or an authorized Gmail alias.'
            )

        message = EmailMultiAlternatives(
            subject='Wasalni SMTP configuration test',
            body='This is a test message from the Wasalni application.',
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[recipient],
        )
        try:
            sent = message.send(fail_silently=False)
        except SMTPSenderRefused as error:
            refused_sender = error.sender
            local_part, separator, domain = refused_sender.partition('@')
            masked_sender = (
                f'{local_part[:1]}***@{domain}' if separator else '[invalid address]'
            )
            raise CommandError(
                f'Gmail SMTP refused sender {masked_sender} '
                f'(SMTP {error.smtp_code}). Use the authenticated Gmail address '
                'or an authorized alias.'
            ) from error
        except SMTPAuthenticationError as error:
            raise CommandError(
                f'Gmail SMTP authentication failed (SMTP {error.smtp_code}). '
                'Use the Gmail account address and a Google App Password.'
            ) from error
        except SMTPRecipientsRefused as error:
            raise CommandError(
                f'The SMTP server rejected recipient {recipient}. '
                'Check the address and Gmail account restrictions.'
            ) from error
        except (SMTPConnectError, SMTPServerDisconnected, OSError) as error:
            raise CommandError(
                f'Could not connect to the SMTP server ({type(error).__name__}). '
                'Check SMTP host, port, TLS, firewall, and network access.'
            ) from error
        except SMTPException as error:
            raise CommandError(
                f'SMTP rejected the test message ({type(error).__name__}).'
            ) from error
        except InvalidMailer as error:
            raise CommandError(
                'Django could not construct the configured email backend. '
                'Check EMAIL_BACKEND and its settings.'
            ) from error

        if sent != 1:
            raise CommandError(
                f'The configured backend accepted {sent} messages; expected 1.'
            )

        self.stdout.write(self.style.SUCCESS(
            f'SMTP server accepted the test message from {sender}. '
            'This confirms SMTP acceptance, not delivery to the inbox.'
        ))
