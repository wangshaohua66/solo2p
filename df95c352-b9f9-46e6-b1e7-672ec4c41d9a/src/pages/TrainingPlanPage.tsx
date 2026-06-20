import { useOutletContext } from "react-router-dom";
import TrainingPlanEditor from "@/components/PlanBuilder/TrainingPlanEditor";
import type { Member } from "@/types";

export default function TrainingPlanPage() {
  const { member } = useOutletContext<{ member: Member }>();
  return <TrainingPlanEditor member={member} />;
}
