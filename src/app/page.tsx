import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export default async function Home() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/auth/login');

  const role = session.user?.role;
  if (role === 'superadmin') redirect('/admin/dashboard');
  if (role === 'teacher') redirect('/teacher/dashboard');
  if (role === 'student') redirect('/student/dashboard');
  redirect('/auth/login');
}
