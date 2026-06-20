import { useEffect } from "react";
import { useParams, NavLink, Outlet, useNavigate } from "react-router-dom";
import { User, ClipboardList, BarChart3, UtensilsCrossed, ArrowLeft } from "lucide-react";
import { useMemberStore } from "@/stores/memberStore";
import { usePlanStore } from "@/stores/planStore";
import { useUIStore } from "@/stores/uiStore";
import { getGoalLabel } from "@/hooks/useTrainingVolume";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "", label: "档案", icon: User, end: true },
  { to: "plan", label: "计划", icon: ClipboardList },
  { to: "progress", label: "进度", icon: BarChart3 },
  { to: "diet", label: "饮食", icon: UtensilsCrossed },
];

export default function MemberDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const member = useMemberStore((s) => s.members.find((m) => m.id === id));
  const setSelectedMember = useMemberStore((s) => s.setSelectedMember);
  const setRightPanelContent = useUIStore((s) => s.setRightPanelContent);
  const initMembers = useMemberStore((s) => s.initMockData);
  const initPlans = usePlanStore((s) => s.initMockData);

  useEffect(() => {
    initMembers();
    initPlans();
  }, [initMembers, initPlans]);

  useEffect(() => {
    if (id) {
      setSelectedMember(id);
      setRightPanelContent("stats");
    }
  }, [id, setSelectedMember, setRightPanelContent]);

  if (!member) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8">
        <User className="h-12 w-12 text-text-muted" />
        <p className="text-sm text-text-muted">未找到该学员</p>
        <button type="button" onClick={() => navigate("/")} className="btn-secondary text-sm">
          返回概览
        </button>
      </div>
    );
  }

  const goalInfo = getGoalLabel(member.goal);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border bg-background-panel/50 px-5 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="btn-ghost p-1.5"
            aria-label="返回"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-cyan/60 to-brand-violet/60 text-sm font-semibold text-white">
            {member.name.charAt(0)}
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-bold text-text-primary">{member.name}</h2>
            <p className="text-[11px] text-text-muted">
              {member.gender === "male" ? "男" : "女"} · {member.height}cm · {member.weight}kg · <span className={goalInfo.color}>{goalInfo.label}</span>
            </p>
          </div>
          <nav className="flex gap-1 rounded-lg border border-border bg-background p-1">
            {tabs.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    isActive
                      ? "bg-brand-cyan/15 text-brand-cyan"
                      : "text-text-secondary hover:text-text-primary"
                  )
                }
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        <Outlet context={{ member }} />
      </div>
    </div>
  );
}
