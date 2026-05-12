import { notFound } from 'next/navigation';
import Link from 'next/link';
import { renderEmployeeResponse } from '@/components/EmployeeResponseView';

export default async function AdminEmployeeResponsePage(props: { params: Promise<{ id: string; employeeId: string }> }) {
  const { id, employeeId } = await props.params;
  const view = await renderEmployeeResponse({ campaignId: id, employeeId });
  if (!view) return notFound();
  return (
    <div className="space-y-4">
      <div className="flex">
        <Link href={`/admin/campaigns/${id}/responses`} className="btn-secondary">
          ← All responses
        </Link>
      </div>
      {view}
    </div>
  );
}
