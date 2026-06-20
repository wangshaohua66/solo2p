import { useOutletContext } from "react-router-dom";
import MemberProfile from "@/components/Member/MemberProfile";
import type { Member } from "@/types";

export default function MemberProfilePage() {
  const { member } = useOutletContext<{ member: Member }>();
  return <MemberProfile member={member} />;
}
