import { AppShell } from '@/components/layout/app-shell';
import { IntelligenceReportView } from '@/components/intelligence/live-workspace';
export default function IntelligenceReportPage({ params }: { params: { chain: string; token: string } }) {
  return <AppShell initialView="intelligence"><IntelligenceReportView key={params.chain + ':' + params.token} chain={params.chain} mint={params.token} /></AppShell>;
}
