import { useOutletContext } from "react-router-dom";
import DietAdvice from "@/components/Diet/DietAdvice";
import type { Member } from "@/types";

export default function DietAdvicePage() {
  const { member } = useOutletContext<{ member: Member }>();
  return <DietAdvice member={member} />;
}
