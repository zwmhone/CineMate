import { useEffect } from 'react';

export default function useLoginPopupLock(popupOpen, onClose) {
  useEffect(() => {
    if (!popupOpen) return undefined;

    const onKey = event => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [popupOpen, onClose]);
}
