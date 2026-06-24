import { supabase } from '@/lib/supabaseClient';

export async function getUserReviewCount(userId) {
  if (!userId) return 0;

  const { data, error } = await supabase
    .from('comments')
    .select('comment_text')
    .eq('user_id', userId);

  if (error) throw new Error(error.message);

  return (data || []).filter(comment => String(comment.comment_text || '').trim().length > 0).length;
}
