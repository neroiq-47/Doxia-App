import { publicGet, publicOptions, failed } from '@/lib/publicApi';
import { listReplies } from '@/lib/data';
export const GET = publicGet<{ id: string }>(async ({ supabase }, { id }) => {
  const replies = await listReplies(supabase, id);
  if (!replies) return failed('replies');
  return { body: { data: replies.map(r => ({ id: r.id, parent_id: r.parent_id, body: r.body, created_at: r.created_at, author: r.profiles })) } };
});
export const OPTIONS = publicOptions;
