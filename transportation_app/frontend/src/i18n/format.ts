import i18n from './index'

function locale() {
  return i18n.resolvedLanguage === 'ar' ? 'ar-EG' : 'en-EG'
}

export function formatDate(
  value: string | Date,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' },
) {
  return new Intl.DateTimeFormat(locale(), options).format(new Date(value))
}

export function formatCurrency(value: string | number, currency = 'EGP') {
  return new Intl.NumberFormat(locale(), { style: 'currency', currency }).format(Number(value))
}

export function formatRelativeTime(value: string) {
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000))
  if (elapsedMinutes < 1) {
    return new Intl.RelativeTimeFormat(locale(), { numeric: 'auto' }).format(0, 'minute')
  }
  if (elapsedMinutes < 60) {
    return new Intl.RelativeTimeFormat(locale(), { numeric: 'auto' }).format(-elapsedMinutes, 'minute')
  }
  const hours = Math.floor(elapsedMinutes / 60)
  if (hours < 24) {
    return new Intl.RelativeTimeFormat(locale(), { numeric: 'auto' }).format(-hours, 'hour')
  }
  const days = Math.floor(hours / 24)
  if (days < 7) {
    return new Intl.RelativeTimeFormat(locale(), { numeric: 'auto' }).format(-days, 'day')
  }
  return formatDate(value, { month: 'short', day: 'numeric' })
}
