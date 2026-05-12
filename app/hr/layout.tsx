import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { StaffNav } from '@/components/StaffNav';

export default async function HrLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'ADMIN' && session.user.role !== 'HR') redirect('/login');
  return (
    <div>
      <StaffNav role="HR" />
      <main id="main-content" className="max-w-7xl mx-auto px-4 lg:px-8 py-6">{children}</main>
    </div>
  );
}
