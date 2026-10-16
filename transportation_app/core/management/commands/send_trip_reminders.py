from django.core.management.base import BaseCommand

from core.services.notification_service import create_due_trip_reminders


class Command(BaseCommand):
    help = 'Create due 24-hour and 2-hour notifications for confirmed trip bookings.'

    def handle(self, *args, **options):
        created = create_due_trip_reminders()
        self.stdout.write(self.style.SUCCESS(f'Created {created} trip reminder(s).'))
