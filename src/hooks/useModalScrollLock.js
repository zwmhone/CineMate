'use client';

import { useEffect } from 'react';

let modalLockCount = 0;
let savedScrollY = 0;
let savedHtmlStyles = null;
let savedBodyStyles = null;

function saveInlineStyles(element, properties) {
  return properties.reduce((styles, property) => {
    styles[property] = element.style.getPropertyValue(property);
    styles[`${property}Priority`] = element.style.getPropertyPriority(property);
    return styles;
  }, {});
}

function restoreInlineStyles(element, savedStyles, properties) {
  properties.forEach((property) => {
    const value = savedStyles?.[property] || '';
    const priority = savedStyles?.[`${property}Priority`] || '';

    if (value) {
      element.style.setProperty(property, value, priority);
    } else {
      element.style.removeProperty(property);
    }
  });
}

export default function useModalScrollLock(isLocked = false) {
  useEffect(() => {
    if (!isLocked || typeof document === 'undefined' || typeof window === 'undefined') {
      return undefined;
    }

    const html = document.documentElement;
    const body = document.body;
    const htmlProperties = ['overflow', 'scrollbar-gutter'];
    const bodyProperties = ['overflow', 'position', 'top', 'left', 'right', 'width', 'padding-right'];

    if (modalLockCount === 0) {
      savedScrollY = window.scrollY || window.pageYOffset || 0;
      savedHtmlStyles = saveInlineStyles(html, htmlProperties);
      savedBodyStyles = saveInlineStyles(body, bodyProperties);

      const scrollbarWidth = Math.max(0, window.innerWidth - html.clientWidth);
      const lockedBodyWidth = scrollbarWidth > 0 ? `calc(100% - ${scrollbarWidth}px)` : '100%';

      html.classList.add('cm-modal-open');
      body.classList.add('cm-modal-open');

      html.style.setProperty('overflow', 'hidden', 'important');
      html.style.setProperty('scrollbar-gutter', 'stable', 'important');

      body.style.setProperty('overflow', 'hidden', 'important');
      body.style.setProperty('position', 'fixed', 'important');
      body.style.setProperty('top', `-${savedScrollY}px`, 'important');
      body.style.setProperty('left', '0', 'important');
      body.style.setProperty('right', 'auto', 'important');
      body.style.setProperty('width', lockedBodyWidth, 'important');
      body.style.setProperty('padding-right', '0', 'important');
    }

    modalLockCount += 1;

    return () => {
      modalLockCount = Math.max(0, modalLockCount - 1);

      if (modalLockCount !== 0) return;

      html.classList.remove('cm-modal-open');
      body.classList.remove('cm-modal-open');

      restoreInlineStyles(html, savedHtmlStyles, htmlProperties);
      restoreInlineStyles(body, savedBodyStyles, bodyProperties);

      window.scrollTo(0, savedScrollY);

      savedScrollY = 0;
      savedHtmlStyles = null;
      savedBodyStyles = null;
    };
  }, [isLocked]);
}
