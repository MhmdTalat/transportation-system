interface Props {
  subtitle: string
}

export function BrandLogo({ subtitle }: Props) {
  return (
    <>
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 40 40" fill="none">
          <path d="M20 35.25s11-9.3 11-19.25a11 11 0 1 0-22 0c0 9.95 11 19.25 11 19.25Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <circle cx="20" cy="14.2" r="4.6" stroke="currentColor" strokeWidth="2" />
          <path d="M20 11.5v5.4m-2.3-4.9 4.6 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </span>
      <span className="brand-copy">
        <strong lang="ar" dir="rtl">وصلني</strong>
        <small><span>WASALNI</span><span aria-hidden="true"> · </span>{subtitle}</small>
      </span>
    </>
  )
}
