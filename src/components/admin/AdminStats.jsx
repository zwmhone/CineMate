const STAT_CARDS = [
  ['users', 'totalUsers', 'Users', 'Registered accounts'],
  ['banned', 'bannedUsers', 'Banned', 'Blocked accounts'],
  ['comments', 'totalComments', 'Comments', 'All user comments'],
  ['reports', 'openReports', 'Open Reports', 'Reports waiting for review'],
  ['ratings', 'totalRatings', 'Ratings', 'User star ratings'],
  ['favourites', 'totalFavourites', 'Favourites', 'User saved favourites'],
];

export default function AdminStats({ overview, activeView = 'users', onSelect }) {
  return (
    <section className="cm-admin-stats-grid" aria-label="Admin statistics">
      {STAT_CARDS.map(([view, key, label, description]) => (
        <button
          key={key}
          type="button"
          className={`cm-admin-stat-card ${activeView === view ? 'active' : ''}`}
          onClick={() => onSelect?.(view)}
          aria-pressed={activeView === view}
        >
          <strong>{overview?.[key] ?? 0}</strong>
          <span>{label}</span>
          <small>{description}</small>
        </button>
      ))}
    </section>
  );
}
