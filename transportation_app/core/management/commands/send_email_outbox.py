from datetime import timedelta
from smtplib import SMTPException

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from core.models import EmailOutbox


class EmailDeliveryError(Exception):
    pass


class Command(BaseCommand):
    help = 'Send queued account and booking emails, retrying transient failures.'

    def handle(self, *args, **options):
        now = timezone.now()
        sent_count = 0
        failed_count = 0
        message_ids = list(
            EmailOutbox.objects.filter(
                status__in=('pending', 'failed'),
                attempts__lt=5,
                available_at__lte=now,
            ).order_by('created_at').values_list('pk', flat=True)[:100]
        )

        for message_id in message_ids:
            with transaction.atomic():
                message_record = EmailOutbox.objects.select_for_update().get(pk=message_id)
                if (
                    message_record.status not in ('pending', 'failed')
                    or message_record.attempts >= 5
                    or message_record.available_at > timezone.now()
                ):
                    continue
                email = EmailMultiAlternatives(
                    subject=message_record.subject,
                    body=message_record.body,
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    to=[message_record.recipient_email],
                )
                try:
                    delivered = email.send(fail_silently=False)
                    if delivered != 1:
                        raise EmailDeliveryError('The configured email backend sent no messages.')
                except (EmailDeliveryError, OSError, SMTPException) as error:
                    message_record.attempts += 1
                    message_record.status = 'failed'
                    message_record.last_error = str(error)[:2000]
                    delay_minutes = min(2 ** message_record.attempts, 60)
                    message_record.available_at = timezone.now() + timedelta(
                        minutes=delay_minutes,
                    )
                    message_record.save(update_fields=(
                        'attempts',
                        'status',
                        'last_error',
                        'available_at',
                    ))
                    failed_count += 1
                else:
                    message_record.attempts += 1
                    message_record.status = 'sent'
                    message_record.sent_at = timezone.now()
                    message_record.last_error = ''
                    message_record.save(update_fields=(
                        'attempts',
                        'status',
                        'sent_at',
                        'last_error',
                    ))
                    sent_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f'Sent {sent_count} email(s); recorded {failed_count} failure(s).'
            )
        )
