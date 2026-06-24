import DashboardKpiCard from './DashboardKpiCard';

export default function DashboardSummary({
  totalFavourites = 0,
  watchedCount = 0,
  averageRating = '0.0',
  totalReviews = 0,
}) {
  const kpis = [
    { label: 'Favourites', value: totalFavourites },
    { label: 'Watched', value: watchedCount },
    { label: 'Avg Rating', value: averageRating },
    { label: 'Reviews', value: totalReviews },
  ];

  return (
    <section className="glass-panel profile-panel reveal">
      <h3>Movie Profile</h3>
      <div className="profile-stats dashboard-kpi-grid">
        {kpis.map(kpi => (
          <DashboardKpiCard key={kpi.label} value={kpi.value} label={kpi.label} />
        ))}
      </div>
    </section>
  );
}
