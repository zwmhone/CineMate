export default function ProfileStats({ stats }) {
  const cards = [
    { label: 'Favourites', value: stats?.favourites ?? 0 },
    { label: 'Watched', value: stats?.watched ?? 0 },
    { label: 'Wishlist', value: stats?.wishlist ?? 0 },
    { label: 'Ratings', value: stats?.ratings ?? 0 },
    { label: 'Reviews', value: stats?.reviews ?? 0 },
    { label: 'Avg Rating', value: stats?.averageRating ?? '0.0' },
  ];

  return (
    <section className="profile-stat-grid" aria-label="Profile statistics">
      {cards.map(card => (
        <article key={card.label} className="profile-stat-card">
          <strong>{card.value}</strong>
          <span>{card.label}</span>
        </article>
      ))}
    </section>
  );
}
