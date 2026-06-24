import { supabase } from '@/lib/supabaseClient';

function friendlyAdminError(error) {
  const message = String(error?.message || error || 'Admin action failed. Please try again.');
  if (/Admin access required/i.test(message)) return 'Admin access required. Please log in with an admin account.';
  if (/function.*not found|schema cache|could not find|not found/i.test(message)) return 'Admin setup is not installed yet. Run database/admin_moderation.sql once in Supabase.';
  if (/structure of query does not match function result type/i.test(message)) return 'Admin SQL needs updating. Run database/admin_moderation.sql once in Supabase.';
  return message;
}

async function callRpc(name, args = {}) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(friendlyAdminError(error));
  return data;
}

async function callRpcOptional(name, args = {}, fallbackValue = null) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) {
    const message = String(error.message || '');
    if (/function.*not found|schema cache|could not find|not found/i.test(message)) return fallbackValue;
    throw new Error(friendlyAdminError(error));
  }
  return data;
}

export async function getAdminOverview() {
  const data = await callRpc('admin_get_overview');
  return {
    totalUsers: Number(data?.totalUsers || 0),
    bannedUsers: Number(data?.bannedUsers || 0),
    totalMovies: Number(data?.totalMovies || 0),
    totalFavourites: Number(data?.totalFavourites || 0),
    totalRatings: Number(data?.totalRatings || 0),
    totalComments: Number(data?.totalComments || 0),
    hiddenComments: Number(data?.hiddenComments || 0),
    openReports: Number(data?.openReports || 0),
  };
}

export async function listAdminUsers() {
  const rows = await callRpc('admin_list_users');
  return Array.isArray(rows) ? rows : [];
}

export async function setAdminUserBan(userId, shouldBan, reason = '') {
  if (!userId) throw new Error('Missing user id.');
  await callRpc('admin_set_user_ban', {
    target_user_id: userId,
    should_ban: Boolean(shouldBan),
    reason_text: reason || null,
  });
  return true;
}

export async function listAdminComments() {
  const rows = await callRpcOptional('admin_list_comments', {}, null);
  if (Array.isArray(rows)) return rows;

  const moderationRows = await callRpc('admin_list_moderation_reports');
  return Array.isArray(moderationRows) ? moderationRows : [];
}

export async function hideAdminComment(commentId, reason = 'Removed by admin', sourceType = 'movie') {
  if (!commentId) throw new Error('Missing comment id.');
  const ok = await callRpcOptional('admin_hide_reported_comment', {
    source_type_text: sourceType || 'movie',
    target_comment_id: String(commentId),
    reason_text: reason || 'Removed by admin',
  }, null);
  if (ok === null) {
    await callRpc('admin_hide_comment', {
      target_comment_id: commentId,
      reason_text: reason || 'Removed by admin',
    });
  }
  return true;
}

export async function unhideAdminComment(commentId, sourceType = 'movie') {
  if (!commentId) throw new Error('Missing comment id.');
  const ok = await callRpcOptional('admin_unhide_reported_comment', {
    source_type_text: sourceType || 'movie',
    target_comment_id: String(commentId),
  }, null);
  if (ok === null) await callRpc('admin_unhide_comment', { target_comment_id: commentId });
  return true;
}

export async function dismissAdminCommentReports(commentId, sourceType = 'movie') {
  if (!commentId) throw new Error('Missing comment id.');
  const ok = await callRpcOptional('admin_dismiss_reported_comment_reports', {
    source_type_text: sourceType || 'movie',
    target_comment_id: String(commentId),
  }, null);
  if (ok === null) await callRpc('admin_dismiss_comment_reports', { target_comment_id: commentId });
  return true;
}

export async function listAdminMovies() {
  const rows = await callRpc('admin_list_movies');
  return Array.isArray(rows) ? rows : [];
}

export async function deleteAdminComment(commentId, sourceType = 'movie') {
  if (!commentId) throw new Error('Missing comment id.');
  const ok = await callRpcOptional('admin_delete_reported_comment', {
    source_type_text: sourceType || 'movie',
    target_comment_id: String(commentId),
  }, null);
  if (ok === null) await callRpc('admin_delete_comment', { target_comment_id: commentId });
  return true;
}

export async function listAdminModerationWarnings() {
  const rows = await callRpcOptional('admin_list_moderation_warnings', {}, []);
  return Array.isArray(rows) ? rows : [];
}

export async function issueAdminModerationWarning({ userId, sourceType = 'manual', sourceId = '', reason = '' } = {}) {
  if (!userId) throw new Error('Missing user id.');
  await callRpc('admin_issue_moderation_warning', {
    target_user_id: userId,
    source_type_text: sourceType || 'manual',
    source_id_text: sourceId ? String(sourceId) : null,
    reason_text: reason || 'Warning issued by admin',
  });
  return true;
}

export async function removeAdminModerationWarning(warningId, reason = 'Warning removed by admin') {
  if (!warningId) throw new Error('Missing warning id.');
  await callRpc('admin_remove_moderation_warning', {
    target_warning_id: warningId,
    removal_reason_text: reason || 'Warning removed by admin',
  });
  return true;
}
