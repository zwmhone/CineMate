export default function DashboardKpiCard({ value = 0, label = 'Metric' }) {
  return (
    <div className="dashboard-kpi-card">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}
