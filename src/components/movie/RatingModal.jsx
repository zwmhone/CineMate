'use client';

export function openRatingModal({ initial = 0, initialReview = '', hasExisting = false, onSubmit, onDelete }) {
  const existingModal = document.querySelector('.rating-modal-backdrop');
  if (existingModal) existingModal.remove();

  let selected = Number(initial || 0);
  const modal = document.createElement('div');
  modal.className = 'rating-modal-backdrop';
  modal.innerHTML = `
    <div class="rating-modal" role="dialog" aria-modal="true" aria-label="Rate this movie">
      <button type="button" class="rating-modal-close" aria-label="Close rating popup">×</button>
      <h3>${hasExisting ? 'Update your rating' : 'Rate this movie'}</h3>
      <p>${hasExisting ? 'You already rated this movie. Update or delete it here.' : 'Tap a star to rate. A review is optional.'}</p>
      <div class="rating-modal-stars" aria-label="Choose rating">
        ${[1, 2, 3, 4, 5]
          .map(index => `<button type="button" data-rate="${index}" class="${index <= selected ? 'active' : ''}" aria-label="${index} star${index > 1 ? 's' : ''}">${index <= selected ? '★' : '☆'}</button>`)
          .join('')}
      </div>
      <textarea class="rating-modal-review" placeholder="Write a review/comment... optional"></textarea>
      <p class="rating-modal-error" aria-live="polite"></p>
      <div class="rating-modal-actions">
        ${hasExisting ? '<button type="button" class="rating-modal-delete">Delete Rating</button>' : ''}
        <button type="button" class="rating-modal-submit">${hasExisting ? 'Update Rating' : 'Submit Rating'}</button>
      </div>
    </div>`;

  document.body.appendChild(modal);
  const textarea = modal.querySelector('.rating-modal-review');
  if (textarea) textarea.value = initialReview || '';

  const closeModal = () => {
    window.removeEventListener('keydown', onKey);
    modal.remove();
  };

  const onKey = event => {
    if (event.key === 'Escape') closeModal();
  };

  const refreshStars = () => {
    modal.querySelectorAll('[data-rate]').forEach(button => {
      const active = Number(button.dataset.rate) <= selected;
      button.classList.toggle('active', active);
      button.textContent = active ? '★' : '☆';
    });
  };

  const showError = message => {
    const error = modal.querySelector('.rating-modal-error');
    if (error) error.textContent = message || '';
  };

  window.addEventListener('keydown', onKey);

  modal.addEventListener('click', async event => {
    if (event.target === modal || event.target.closest('.rating-modal-close')) {
      closeModal();
      return;
    }

    const rateButton = event.target.closest('[data-rate]');
    if (rateButton) {
      selected = Number(rateButton.dataset.rate);
      refreshStars();
      return;
    }

    if (event.target.closest('.rating-modal-delete')) {
      if (typeof onDelete !== 'function') return;
      const deleteButton = modal.querySelector('.rating-modal-delete');
      const submitButton = modal.querySelector('.rating-modal-submit');

      try {
        deleteButton.disabled = true;
        if (submitButton) submitButton.disabled = true;
        deleteButton.textContent = 'Deleting...';
        await Promise.resolve(onDelete());
        closeModal();
      } catch (err) {
        showError(err?.message || 'Could not delete your rating. Please try again.');
        deleteButton.disabled = false;
        if (submitButton) submitButton.disabled = false;
        deleteButton.textContent = 'Delete Rating';
      }
      return;
    }

    if (event.target.closest('.rating-modal-submit')) {
      const submitButton = modal.querySelector('.rating-modal-submit');
      const deleteButton = modal.querySelector('.rating-modal-delete');
      const review = modal.querySelector('.rating-modal-review')?.value.trim() || '';

      if (selected <= 0) {
        showError('Please choose 1 to 5 stars before submitting.');
        return;
      }

      if (typeof onSubmit === 'function') {
        try {
          submitButton.disabled = true;
          if (deleteButton) deleteButton.disabled = true;
          submitButton.textContent = 'Saving...';
          await Promise.resolve(onSubmit(selected, review));
          closeModal();
        } catch (err) {
          showError(err?.message || 'Could not save your rating. Please try again.');
          submitButton.disabled = false;
          if (deleteButton) deleteButton.disabled = false;
          submitButton.textContent = hasExisting ? 'Update Rating' : 'Submit Rating';
        }
      }
    }
  });
}

export default function RatingModal() {
  return null;
}
