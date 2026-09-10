import { handleAuth } from '@workos-inc/authkit-nextjs';
import { upsertUserFromWorkos } from '@/lib/auth/user-sync';

export const runtime = 'nodejs';

export const GET = handleAuth({
  returnPathname: '/projects',
  onSuccess: async ({ user }) => {
    await upsertUserFromWorkos(user);
  },
});
