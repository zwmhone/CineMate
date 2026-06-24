
import './globals.css';
import { AuthProvider } from '@/lib/AuthContext';

export const metadata = { title: 'CineMate', description: 'Personalised movie discovery' };
export default function RootLayout({ children }) {
  return <html lang="en"><body><AuthProvider>{children}</AuthProvider></body></html>;
}
