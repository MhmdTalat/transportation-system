import { useTranslation } from 'react-i18next'

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation()

  function changeLanguage(language: string) {
    void i18n.changeLanguage(language)
  }

  return (
    <label className="language-switcher">
      <span className="visually-hidden">{t('Language')}</span>
      <i className="bi bi-translate" aria-hidden="true" />
      <select
        aria-label={t('Language')}
        value={i18n.language === 'en' ? 'en' : 'ar'}
        onChange={(event) => changeLanguage(event.target.value)}
      >
        <option value="ar">العربية</option>
        <option value="en">English</option>
      </select>
    </label>
  )
}
