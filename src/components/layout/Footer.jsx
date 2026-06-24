"use client";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
export default function Footer() {
  const { isLoggedIn } = useAuth();
  return (
    <footer className="footer simple-contact-footer">
      <div className="footer-wrap">
        <div className="footer-about">
          <div className="footer-mark">
            <img alt="CineMate logo" src="/cinemate_logo.svg" />
          </div>
          <div>
            <h3>CineMate</h3>
            <p>
              Personalised movie discovery for searching, rating, saving and
              tracking films.
            </p>
          </div>
        </div>
        <div className="footer-group">
          <h4>Site Map</h4>
          <Link href="/">Home</Link>
          <Link href="/movies">Genres</Link>
          {isLoggedIn && (
            <>
              <Link href="/recommendations">Recommendations</Link>
              <Link href="/dashboard">Dashboard</Link>
            </>
          )}
        </div>
        <div className="footer-group">
          <h4>Project</h4>
          {isLoggedIn ? (
            <>
              <Link href="/recommendations">Personalised Matches</Link>
              <Link href="/dashboard">User Dashboard</Link>
            </>
          ) : (
            <>
              <Link href="/login">Sign Up / Login</Link>
            </>
          )}
        </div>
        <div className="footer-group contact-group">
          <h4>Contact Us</h4>
          <div className="contact-icons">
            <a aria-label="Email" href="mailto:zunwuttmhone@gmail.com">
              ✉
            </a>
            <a
              aria-label="GitHub"
              href="https://github.com/zwmhone"
              rel="noopener"
              target="_blank"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.1 3.29 9.43 7.86 10.96.58.1.79-.25.79-.56v-2.04c-3.2.7-3.88-1.37-3.88-1.37-.52-1.34-1.28-1.7-1.28-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.2 1.77 1.2 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.56-.29-5.25-1.28-5.25-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.47.11-3.06 0 0 .97-.31 3.18 1.18A11.1 11.1 0 0 1 12 6.14c.98 0 1.96.13 2.88.39 2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.24 2.77.12 3.06.74.81 1.18 1.84 1.18 3.1 0 4.43-2.7 5.4-5.27 5.69.42.36.78 1.07.78 2.16v3.2c0 .31.21.67.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
              </svg>
            </a>
            <a
              aria-label="LinkedIn"
              href="https://www.linkedin.com/in/zun-wutt-mhone-133210312"
            >
              in
            </a>
          </div>
        </div>
      </div>
      <div className="footer-bottom">© 2026 CineMate • Final Year Project</div>
    </footer>
  );
}
