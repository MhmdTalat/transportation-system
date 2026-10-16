import { useAuth } from '../auth/useAuth'

export function ProfilePage() {
  const { user } = useAuth()
  if (!user) return <section className="page-error"><h1>Profile unavailable</h1><p>Your account details are not available right now.</p></section>

  const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username
  return (
    <div className="passenger-page account-profile-page">
      <header className="page-heading account-profile-heading">
        <div>
          <span className="eyebrow">ACCOUNT DETAILS</span>
          <h1>Your profile</h1>
          <p>Review the personal information connected to your Wasalni account.</p>
        </div>
        <span className="account-profile-secure"><i className="bi bi-shield-check" aria-hidden="true" /> Signed-in account</span>
      </header>
      <section className="panel account-profile-card" aria-labelledby="account-profile-name">
        <div className="account-profile-overview">
          <span className="profile-avatar account-profile-avatar" aria-hidden="true">
            {name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}
          </span>
          <div className="account-profile-intro">
            <span className="eyebrow">{user.role} account</span>
            <h2 id="account-profile-name">{name}</h2>
            <p><i className="bi bi-at" aria-hidden="true" />{user.username}</p>
          </div>
          <span className="account-profile-role"><i className="bi bi-person-badge" aria-hidden="true" />{user.role}</span>
        </div>

        <div className="account-profile-section-heading">
          <div>
            <h3>Personal information</h3>
            <p>Contact details and account identity.</p>
          </div>
        </div>
        <dl className="account-profile-details">
          <div>
            <dt><i className="bi bi-envelope" aria-hidden="true" />Email address</dt>
            <dd>{user.email || 'Not provided'}</dd>
          </div>
          <div>
            <dt><i className="bi bi-telephone" aria-hidden="true" />Phone number</dt>
            <dd>{user.phone_number || 'Not provided'}</dd>
          </div>
          <div>
            <dt><i className="bi bi-person-badge" aria-hidden="true" />Account role</dt>
            <dd>{user.role}</dd>
          </div>
        </dl>
      </section>
    </div>
  )
}
