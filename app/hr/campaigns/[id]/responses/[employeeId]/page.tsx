import { notFound } from 'next/navigation';
import Link from 'next/link';
import { renderEmployeeResponse } from '@/components/EmployeeResponseView';

export default async function HrEmployeeResponsePage(props: { params: Promise<{ id: string; employeeId: string }> }) {
  const { id, employeeId } = await props.params;
  const view = await renderEmployeeResponse({ campaignId: id, employeeId });
  if (!view) return notFound();
  return (
    <div className="space-y-4">
      <Link href={`/hr/campaigns/${id}/responses`} className="text-sm text-[color:var(--text-secondary)] hover:underline">← All responses</Link>
      {view}
    </div>
  );
}
