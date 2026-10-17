import { requireUser } from '@/lib/auth';
import { jsonError, jsonOk } from '@/lib/http';
import { getProject } from '@/lib/data';
export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const { supabase, user } = await requireUser();
  const project = await getProject(supabase, user?.id ?? null, slug);
  if (!project) return jsonError('Project not found.', 404);
  return jsonOk(project);
}
