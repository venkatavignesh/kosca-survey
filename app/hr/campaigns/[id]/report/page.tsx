import { ReportView } from '@/components/ReportView';

export default async function HrReportPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  return (
    <ReportView
      campaignId={id}
      sp={sp}
      basePath={`/hr/campaigns/${id}/report`}
      backHref={`/hr/campaigns/${id}`}
      exportBase={`/api/hr/campaigns/${id}/report/export`}
    />
  );
}
