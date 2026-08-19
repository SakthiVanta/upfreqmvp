import { redirect } from 'next/navigation';

// The Agent Workspace was merged into /projects — each project now
// represents one robot's autonomy codebase, with the audit trigger and
// analysis explorer living directly on its card. This route stays only so
// old links/bookmarks keep working.
export default function DashboardRedirect() {
  redirect('/projects');
}
