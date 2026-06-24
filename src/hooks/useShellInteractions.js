import { useEffect } from 'react';

function closeOpenCustomSelects(except = null) {
  document.querySelectorAll('.custom-select.open').forEach(select => {
    if (select !== except) select.classList.remove('open');
  });
}

function initialiseNativeSelect(selectElement) {
  if (selectElement.dataset.customReady === '1') return;
  if (selectElement.nextElementSibling?.classList?.contains('custom-select')) return;

  selectElement.dataset.customReady = '1';
  const wrapper = document.createElement('div');
  wrapper.className = 'custom-select';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'custom-select-btn';
  button.textContent = selectElement.options[selectElement.selectedIndex]?.textContent || 'Select';

  const list = document.createElement('div');
  list.className = 'custom-select-options';

  Array.from(selectElement.options).forEach((option, index) => {
    const item = document.createElement('div');
    item.className = `custom-option${index === selectElement.selectedIndex ? ' active' : ''}`;
    item.textContent = option.textContent;
    item.addEventListener('click', () => {
      selectElement.selectedIndex = index;
      button.textContent = option.textContent;
      list.querySelectorAll('.custom-option').forEach(current => current.classList.remove('active'));
      item.classList.add('active');
      wrapper.classList.remove('open');
    });
    list.appendChild(item);
  });

  button.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    closeOpenCustomSelects(wrapper);
    wrapper.classList.toggle('open');
  });

  wrapper.append(button, list);
  selectElement.insertAdjacentElement('afterend', wrapper);
}

export default function useShellInteractions({ router, isLoggedIn, onRequireLogin }) {
  useEffect(() => {
    document.querySelectorAll('select').forEach(initialiseNativeSelect);

    const onDocumentClose = () => closeOpenCustomSelects();

    const onClick = event => {
      if (event.defaultPrevented) return;

      const button = event.target.closest('button');
      const interactive = event.target.closest('a, input, textarea, select, option, [data-no-card-nav]');

      if (button && !button.dataset.href) return;
      if (interactive && !interactive.dataset?.href && !event.target.closest('[data-href] button[data-href]')) return;

      const link = event.target.closest('[data-href]');
      if (link) {
        router.push(link.dataset.href);
        return;
      }

      if (button) {
        const text = (button.textContent || '').trim().toLowerCase();

        if (text === 'view' && button.dataset.href) {
          router.push(button.dataset.href);
          return;
        }
      }
    };

    const preventSubmit = event => event.preventDefault();
    document.addEventListener('click', onDocumentClose);
    document.addEventListener('click', onClick);
    document.querySelectorAll('form').forEach(form => form.addEventListener('submit', preventSubmit));

    return () => {
      document.removeEventListener('click', onDocumentClose);
      document.removeEventListener('click', onClick);
      document.querySelectorAll('form').forEach(form => form.removeEventListener('submit', preventSubmit));
    };
  }, [router, isLoggedIn, onRequireLogin]);
}
