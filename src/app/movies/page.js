import AppShell from '@/components/layout/AppShell';
import MovieBrowsePage from '@/components/movie/MovieBrowsePage';

export default function Movies() {
  return <AppShell page="genres"><MovieBrowsePage /></AppShell>;
}
