import { createClient } from '@/lib/supabase/server';
import { jsonError, jsonOk } from '@/lib/http';
import { listProjects } from '@/lib/data';
export async function GET() {
  const projects = await listProjects(await createClient());
  if (!projects) return jsonError('Could not load projects.', 500);
  return jsonOk({ projects });
}
