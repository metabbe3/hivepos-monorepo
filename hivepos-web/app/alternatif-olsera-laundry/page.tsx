import { ComparisonPage } from "@/components/alternatif/comparison-page";
import { competitorMetadata, getCompetitor } from "@/lib/alternatif-data";

const data = getCompetitor("alternatif-olsera-laundry")!;

export const metadata = competitorMetadata(data);

export default function Page() {
  return <ComparisonPage data={data} />;
}
