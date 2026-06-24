'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from './Navbar';
import Footer from './Footer';
import LoginPromptModal from '@/components/common/LoginPromptModal';
import ModerationWarningModal from '@/components/notifications/ModerationWarningModal';
import { useAuth } from '@/lib/AuthContext';
import useBodyPageState from '@/hooks/useBodyPageState';
import useLoginPopupLock from '@/hooks/useLoginPopupLock';
import useShellInteractions from '@/hooks/useShellInteractions';
import useModalScrollLock from '@/hooks/useModalScrollLock';



function parseBanReason(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return { summary: '', items: [] };

  const lines = raw
    .split(/\r?\n/)
    .map(line => line.trim().replace(/^[-•*]+\s*/, ''))
    .filter(Boolean);

  const autoBanSummary = lines.find(line => /account banned after/i.test(line)) || '';
  const warningLines = lines.filter(line => /^(first|second|final|third)\s+warning\s*:/i.test(line));

  if (warningLines.length) {
    return { summary: autoBanSummary, items: warningLines };
  }

  const listItems = raw
    .split(/(?:\r?\n|\s*[;•]+\s*)/)
    .map(item => item.trim().replace(/^[-•*]+\s*/, ''))
    .filter(Boolean)
    .filter(item => !/account banned after/i.test(item));

  return { summary: autoBanSummary, items: listItems.length ? listItems : [raw] };
}

function BanReasonBox({ message }) {
  const { summary, items } = parseBanReason(message);
  if (!summary && !items.length) return null;
  return (
    <div className="ban-reason-box">
      {summary && <strong>{summary}</strong>}
      {items.length > 0 && (
        <>
          <p>You are banned for the following reasons:</p>
          <ul>
            {items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
          </ul>
        </>
      )}
    </div>
  );
}

export default function AppShell({ page, children }) {
  const [loginMessage, setLoginMessage] = useState('');
  const [bannedMessage, setBannedMessage] = useState('');
  const { isLoggedIn, user } = useAuth();
  const router = useRouter();

  const closeLoginPrompt = useCallback(() => setLoginMessage(''), []);
  const closeBannedPrompt = useCallback(() => setBannedMessage(''), []);
  const requireLogin = useCallback(message => {
    setLoginMessage(message || 'You must be logged in to use this feature.');
  }, []);

  useBodyPageState(page, isLoggedIn);
  useLoginPopupLock(Boolean(loginMessage), closeLoginPrompt);
  useModalScrollLock(Boolean(bannedMessage));
  useShellInteractions({ router, isLoggedIn, onRequireLogin: requireLogin });

  useEffect(() => {
    const onRequireLoginEvent = event => {
      requireLogin(event.detail || 'You must be logged in to use this feature.');
    };

    window.addEventListener('cinemate:require-login', onRequireLoginEvent);
    return () => window.removeEventListener('cinemate:require-login', onRequireLoginEvent);
  }, [requireLogin]);

  useEffect(() => {
    const onBannedEvent = event => {
      const message = event.detail || 'This account has been banned by an administrator.';
      setBannedMessage(message);
    };

    window.addEventListener('cinemate:account-banned', onBannedEvent);
    return () => window.removeEventListener('cinemate:account-banned', onBannedEvent);
  }, []);

  return (
    <>
      <div className="ambient ambient-one"></div>
      <div className="ambient ambient-two"></div>
      <Navbar />
      <LoginPromptModal message={loginMessage} onClose={closeLoginPrompt} />
      <ModerationWarningModal userId={user?.id || ''} />
      {bannedMessage && (
        <div className="cinemate-confirm-backdrop ban-modal-backdrop" role="presentation" onClick={closeBannedPrompt}>
          <div className="cinemate-confirm-modal ban-modal" role="alertdialog" aria-modal="true" aria-label="Account banned" onClick={event => event.stopPropagation()}>
            <h4>Account banned</h4>
            <p>Your CineMate account has been banned by an administrator.</p>
            <BanReasonBox message={bannedMessage} />
            <div className="cinemate-confirm-actions">
              <button type="button" className="danger" onClick={closeBannedPrompt}>Close</button>
            </div>
          </div>
        </div>
      )}
      {children}
      <Footer />
    </>
  );
}
