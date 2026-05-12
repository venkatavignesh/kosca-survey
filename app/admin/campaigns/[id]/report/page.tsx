import { ReportView } from '@/components/ReportView';

export default async function AdminReportPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  return (
    <ReportView
      campaignId={id}
      sp={sp}
      basePath={`/admin/campaigns/${id}/report`}
      backHref={`/admin/campaigns/${id}`}
      exportBase={`/api/admin/campaigns/${id}/report/export`}
    />
  );
}
