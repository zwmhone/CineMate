'use client';

import useMovieDetails from '@/hooks/useMovieDetails';
import useRatings from '@/hooks/useRatings';
import useComments from '@/hooks/useComments';
import { useAuth } from '@/lib/AuthContext';
import CastCard from './CastCard';
import CommentBox from './CommentBox';
import CommentList from './CommentList';
import MovieActions, { UserRatingStars } from './MovieActions';
import DislikeIconButton from './DislikeIconButton';
import ShareButton from './ShareButton';
import AddToCollectionButton from '@/components/collections/AddToCollectionButton';
import { MovieMetaStars, MoviePoster, SimilarMovieCard } from './MovieCard';
import { openRatingModal } from './RatingModal';

function requireLogin(message) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('cinemate:require-login', { detail: message }));
}

export default function MovieDetailPage({ movieSlug, mediaType = 'movie' }) {
  const { movie, cast, similar, loading, error } = useMovieDetails(movieSlug, mediaType);
  const { isLoggedIn } = useAuth();
  const { rating, ratingReview, loading: ratingSaving, error: ratingError, refreshRating, saveRating, deleteRating } = useRatings(movie);
  const {
    comments,
    loading: commentsLoading,
    saving: commentSaving,
    error: commentError,
    refreshComments,
    postComment,
    saveRatingReview,
    removeRatingReview,
    editComment,
    removeComment,
    reportComment,
    reactToComment,
    replyToComment,
  } = useComments(movie);

  async function handleRatingClick(initialRating) {
    if (!isLoggedIn) {
      requireLogin('You must be logged in to rate or comment.');
      return;
    }

    openRatingModal({
      initial: rating || initialRating || 0,
      initialReview: ratingReview?.comment_text || '',
      hasExisting: Boolean(rating),
      onSubmit: async (ratingValue, reviewText) => {
        await saveRating(ratingValue);
        if (String(reviewText || '').trim()) {
          await saveRatingReview(ratingValue, reviewText);
        } else if (ratingReview?.comment_id) {
          await removeRatingReview();
        } else {
          await refreshComments();
        }
        await refreshRating();
      },
      onDelete: rating ? async () => {
        await deleteRating();
        await refreshComments();
      } : null,
    });
  }

  async function handleCommentSubmit(text) {
    try {
      await postComment(text);
      return true;
    } catch (err) {
      window.alert(err.message || 'Could not post your comment. Please try again.');
      return false;
    }
  }

  async function handleCommentEdit(commentId, text) {
    try {
      await editComment(commentId, text);
      return true;
    } catch (err) {
      window.alert(err.message || 'Could not update your comment. Please try again.');
      return false;
    }
  }



  async function handleCommentReply(parentCommentId, text) {
    try {
      await replyToComment(parentCommentId, text);
      return true;
    } catch (err) {
      throw err;
    }
  }

  async function handleCommentReaction(commentId, reactionType) {
    try {
      await reactToComment(commentId, reactionType);
      return true;
    } catch (err) {
      throw err;
    }
  }

  async function handleCommentReport(commentId, reason, details) {
    try {
      await reportComment(commentId, reason, details);
      return true;
    } catch (err) {
      return err?.message || 'Could not report this comment. Please try again.';
    }
  }

  async function handleCommentDelete(comment) {
    try {
      if (comment?.isRatingReview) {
        await removeRatingReview();
        await refreshRating();
      } else {
        await removeComment(comment.id);
      }
      await refreshComments();
      return true;
    } catch (err) {
      window.alert(err.message || 'Could not delete your comment. Please try again.');
      return false;
    }
  }

  if (loading && !movie) {
    return (
      <main>
        <section className="details page-section" id="details">
          <div className="detail-hero reveal">
            <div className="detail-poster loading-poster"></div>
            <div className="detail-info">
              <p className="eyebrow">Featured Details</p>
              <h2 className="gradient-text">Loading</h2>
              <p className="meta">Loading movie details...</p>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (!movie) {
    return (
      <main>
        <section className="details page-section" id="details">
          <div className="glass-panel detail-empty-panel reveal">
            <p className="eyebrow">Featured Details</p>
            <h2>Movie details are not available</h2>
            <p className="meta">{error || 'CineMate could not load this movie right now. Please try another movie.'}</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main>
      <section className="details page-section" id="details">
        <div className="detail-hero reveal">
          <MoviePoster movie={movie} extra="detail-poster" size="w500" />
          <div className="detail-info">
            <p className="eyebrow">Featured Details</p>
            <h2 className="gradient-text">{movie.title}</h2>
            <p className="meta">{movie.date} • {movie.runtime} • <MovieMetaStars score={movie.rating} /></p>
            <div className="detail-tags">
              {(movie.tags && movie.tags.length ? movie.tags : [movie.mediaType === 'tv' ? 'TV Show' : 'Movie']).slice(0, 6).map(tag => <span key={tag}>{tag}</span>)}
            </div>
            {error && <p className="meta">Some extra movie data could not be loaded right now.</p>}
            <p>{movie.overview}</p>
            <div className="detail-rating-row">
              <UserRatingStars rating={rating} onRate={handleRatingClick} />
              <DislikeIconButton movie={movie} />
              <ShareButton movie={movie} />
              <AddToCollectionButton movie={movie} />
            </div>
            {ratingSaving && <p className="meta detail-action-message">Saving your rating...</p>}
            {ratingError && <p className="meta detail-action-message">{ratingError}</p>}
            <MovieActions movie={movie} />
          </div>
        </div>

        <div className="detail-layout">
          <div className="left-column">
            <section className="glass-panel reveal">
              <h3>Top Cast</h3>
              {cast.length ? (
                <div className="cast-row" id="castRow">
                  {cast.map((person, index) => <CastCard key={person.id || person.name || index} cast={person} />)}
                </div>
              ) : (
                <p className="meta detail-empty-message">Cast information is not available for this movie yet.</p>
              )}
            </section>

            <section className="glass-panel reveal">
              <h3>User Review</h3>
              <CommentList
                comments={comments}
                loading={commentsLoading}
                saving={commentSaving || ratingSaving}
                onEdit={handleCommentEdit}
                onDelete={handleCommentDelete}
                onReport={handleCommentReport}
                onReact={handleCommentReaction}
                onReply={handleCommentReply}
              />
              {commentError && <p className="meta detail-action-message">{commentError}</p>}
              <CommentBox
                saving={commentSaving}
                isLoggedIn={isLoggedIn}
                onSubmit={handleCommentSubmit}
                onRequireLogin={requireLogin}
              />
            </section>
          </div>

          <aside className="glass-panel reveal">
            <h3>More Like This</h3>
            {similar.length ? (
              <div className="similar-grid" id="similarGrid">
                {similar.map(item => <SimilarMovieCard key={item.id || item.title} movie={item} />)}
              </div>
            ) : (
              <p className="meta detail-empty-message">No similar movies are available for this title yet.</p>
            )}
          </aside>
        </div>
      </section>
    </main>
  );
}
