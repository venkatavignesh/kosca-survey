import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { StaffNav } from '@/components/StaffNav';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'ADMIN') redirect('/hr');
  return (
    <div>
      <StaffNav role="ADMIN" />
      <main id="main-content" className="max-w-7xl mx-auto px-4 lg:px-8 py-6">{children}</main>
    </div>
  );
}
