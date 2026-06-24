'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import NotificationBell from '@/components/notifications/NotificationBell';

function getPublicProfileHref(user) {
  const userId = user?.id || user?.user_id || user?.raw?.id || '';
  return userId ? `/users/${userId}` : '/profile';
}

export default function Navbar(){
  const [open,setOpen]=useState(false);
  const [light,setLight]=useState(false);
  const {isLoggedIn,user}=useAuth();
  const pathname=usePathname();
  const profileHref = getPublicProfileHref(user);
  useEffect(()=>{ const saved=localStorage.getItem('cinemate-theme'); if(saved==='light'){document.body.classList.add('light-mode'); setLight(true);} },[]);
  function toggleTheme(){ const next=!document.body.classList.contains('light-mode'); document.body.classList.toggle('light-mode', next); localStorage.setItem('cinemate-theme',next?'light':'dark'); setLight(next); }
  const nav=[['/','Home'],['/movies','Genres']];
  if(isLoggedIn){ nav.push(['/recommendations','Recommendations'],['/dashboard','Dashboard']); if(user?.isAdmin) nav.push(['/admin','Admin']); }
  const profileAvatar = user?.avatarUrl ? <img alt="" src={user.avatarUrl}/> : <span>{user?.name?.charAt(0)?.toUpperCase() || '👤'}</span>;
  return <header className="site-header"><nav className="navbar">
    <Link aria-label="CineMate home" className="brand" href="/"><img alt="CineMate logo" src="/cinemate_logo.svg"/></Link>
    <button aria-label="Open menu" className="mobile-menu" onClick={()=>setOpen(v=>!v)}>☰</button>
    <div className={`nav-links ${open?'open':''}`} id="navLinks">
      {nav.map(([href,label])=><Link key={href} className={`nav-link ${pathname===href?'active':''}`} href={href} onClick={()=>setOpen(false)}>{label}</Link>)}
      <div className="nav-actions mobile-nav-actions">
        <button aria-label="Switch light and dark mode" className="theme-toggle" onClick={toggleTheme}><span className="sun">☀</span><span className="moon">☾</span></button>
        {isLoggedIn ? <>
          <NotificationBell userId={user?.id} onNavigate={() => setOpen(false)} />
          <Link aria-label="Profile" className="profile-btn" href={profileHref} onClick={()=>setOpen(false)}>{profileAvatar}</Link>
        </> : <Link className="nav-auth-link" href="/login" onClick={()=>setOpen(false)}>Sign Up / Login</Link>}
      </div>
    </div>
    <div className="nav-actions desktop-nav-actions">
      <button aria-label="Switch light and dark mode" className="theme-toggle" onClick={toggleTheme}><span className="sun">☀</span><span className="moon">☾</span></button>
      {isLoggedIn ? <>
        <NotificationBell userId={user?.id} />
        <Link aria-label="Profile" className="profile-btn" href={profileHref}>{profileAvatar}</Link>
      </> : <Link className="nav-auth-link" href="/login">Sign Up / Login</Link>}
    </div>
  </nav></header>
}
