import { publicGet, publicOptions, failed } from '@/lib/publicApi';
import { listProjects } from '@/lib/data';
export const GET = publicGet(async ({ supabase }) => {
  const projects = await listProjects(supabase);
  if (!projects) return failed('projects');
  return { body: { data: projects.map(({ id: _id, signal, ...p }) => ({ ...p, signal: signal && (({ my_vote: _v, ...s }) => s)(signal) })) } };
});
export const OPTIONS = publicOptions;
