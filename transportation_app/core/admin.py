from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import (
    AuditLog,
    Booking,
    BookingSeat,
    Complaint,
    Driver,
    DriverDocument,
    EmailOutbox,
    FareRule,
    Notification,
    OperationalSetting,
    Payment,
    PrivateRide,
    Route,
    RouteStation,
    Station,
    Trip,
    User,
    Vehicle,
)

admin.site.site_header = 'وصلني | Wasalni'
admin.site.site_title = 'وصلني | Wasalni'
admin.site.index_title = 'Administration'


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    list_display = ('username', 'email', 'role', 'phone_number', 'created_at')
    fieldsets = DjangoUserAdmin.fieldsets + (
        ('Wasalni account', {
            'fields': ('role', 'phone_number', 'profile_photo_url', 'email_verified'),
        }),
    )
    add_fieldsets = DjangoUserAdmin.add_fieldsets + (
        ('Wasalni account', {
            'fields': ('role', 'phone_number', 'profile_photo_url', 'email_verified'),
        }),
    )


@admin.register(Station)
class StationAdmin(admin.ModelAdmin):
    list_display = ('name', 'governorate', 'latitude', 'longitude', 'is_active')


@admin.register(Route)
class RouteAdmin(admin.ModelAdmin):
    list_display = ('name', 'distance_km', 'duration_minutes', 'status')


@admin.register(RouteStation)
class RouteStationAdmin(admin.ModelAdmin):
    list_display = ('route', 'station', 'sequence_order')


@admin.register(Vehicle)
class VehicleAdmin(admin.ModelAdmin):
    list_display = ('registration_number', 'capacity', 'status')


@admin.register(Driver)
class DriverAdmin(admin.ModelAdmin):
    list_display = ('user', 'vehicle', 'status')


@admin.register(FareRule)
class FareRuleAdmin(admin.ModelAdmin):
    list_display = ('route', 'rule_type', 'amount', 'is_active')


@admin.register(Trip)
class TripAdmin(admin.ModelAdmin):
    list_display = ('route', 'vehicle', 'driver', 'status', 'fare_amount', 'created_at')


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ('trip', 'amount', 'payment_method', 'status', 'paid_at')


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ('id', 'passenger', 'trip', 'status', 'total_amount', 'created_at')
    list_filter = ('status',)
    search_fields = ('passenger__username', 'passenger__email')


@admin.register(BookingSeat)
class BookingSeatAdmin(admin.ModelAdmin):
    list_display = ('trip', 'booking', 'seat_number', 'is_active')
    list_filter = ('is_active',)


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('user', 'booking', 'title', 'notification_type', 'is_read', 'created_at')


@admin.register(DriverDocument)
class DriverDocumentAdmin(admin.ModelAdmin):
    list_display = ('driver', 'document_type', 'status', 'reviewed_by', 'created_at')
    list_filter = ('document_type', 'status')
    fields = (
        'driver',
        'document_type',
        'original_filename',
        'status',
        'reviewed_by',
        'reviewed_at',
        'rejection_note',
        'created_at',
    )
    readonly_fields = fields

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(PrivateRide)
class PrivateRideAdmin(admin.ModelAdmin):
    list_display = ('passenger', 'driver', 'status', 'created_at')
    list_filter = ('status',)
    readonly_fields = ('passenger', 'driver', 'created_at', 'updated_at')


@admin.register(Complaint)
class ComplaintAdmin(admin.ModelAdmin):
    list_display = ('subject', 'reporter', 'status', 'assigned_to', 'created_at')
    list_filter = ('status',)
    search_fields = ('subject', 'description', 'reporter__email')


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ('action', 'object_type', 'object_id', 'actor', 'created_at')
    list_filter = ('action', 'object_type')
    readonly_fields = (
        'actor',
        'action',
        'object_type',
        'object_id',
        'ip_address',
        'details',
        'created_at',
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(EmailOutbox)
class EmailOutboxAdmin(admin.ModelAdmin):
    list_display = ('recipient_email', 'subject', 'status', 'attempts', 'available_at')
    list_filter = ('status',)
    readonly_fields = ('recipient_email', 'subject', 'body', 'attempts', 'sent_at', 'created_at')


@admin.register(OperationalSetting)
class OperationalSettingAdmin(admin.ModelAdmin):
    list_display = ('key', 'value', 'updated_by', 'updated_at')
