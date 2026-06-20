import { useOutletContext } from "react-router-dom";
import ChartPanel from "@/components/Progress/ChartPanel";
import type { Member } from "@/types";

export default function ProgressDashboardPage() {
  const { member } = useOutletContext<{ member: Member }>();
  return <ChartPanel member={member} />;
}
