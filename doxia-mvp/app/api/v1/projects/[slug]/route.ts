import { publicGet, publicOptions, notFound } from '@/lib/publicApi';
import { getProject, publicDrop } from '@/lib/data';
export const GET = publicGet<{ slug: string }>(async ({ supabase, origin }, { slug }) => {
  const result = await getProject(supabase, null, slug);
  if (!result) return notFound('Project');
  const { id: _id, ...project } = result.project;
  return { body: { data: { ...project, signal: result.signal && (({ my_vote: _v, ...s }) => s)(result.signal), drops: result.drops.map(d => publicDrop(d, origin)) } } };
});
export const OPTIONS = publicOptions;
