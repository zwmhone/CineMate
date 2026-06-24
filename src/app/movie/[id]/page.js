import AppShell from '@/components/layout/AppShell';
import MovieDetailPage from '@/components/movie/MovieDetailPage';

export default async function MovieDetails({ params, searchParams }) {
  const { id } = await params;
  const query = await searchParams;
  const mediaType = query?.type === 'tv' ? 'tv' : 'movie';
  return <AppShell page="detail"><MovieDetailPage movieSlug={id} mediaType={mediaType} /></AppShell>;
}
