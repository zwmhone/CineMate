export default function RecommendationSection({ eyebrow, title, children, className = '' }) {
  return (
    <>
      <div className={`section-heading ${className}`.trim()}>
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
      </div>
      {children}
    </>
  );
}
