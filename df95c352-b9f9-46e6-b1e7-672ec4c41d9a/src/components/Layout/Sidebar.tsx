import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Dumbbell,
  Library,
  ClipboardList,
  UtensilsCrossed,
  PanelRightOpen,
  Dumbbell as Logo,
} from "lucide-react";
import { useUIStore } from "@/stores/uiStore";
import { cn } from "@/lib/utils";
import MemberQuickNav from "./MemberQuickNav";

const navItems = [
  { to: "/", label: "概览", icon: LayoutDashboard, end: true },
  { to: "/exercises", label: "动作库", icon: Library },
  { to: "/templates", label: "模板库", icon: ClipboardList },
];

export default function Sidebar() {
  const toggleRightPanel = useUIStore((s) => s.toggleRightPanel);
  const rightPanelOpen = useUIStore((s) => s.rightPanelOpen);

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-border bg-background-panel">
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-brand-cyan to-brand-violet shadow-glow">
          <Logo className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="font-display text-sm font-bold text-text-primary">FitCoach Pro</h1>
          <p className="text-[10px] text-text-muted">私教管理系统</p>
        </div>
      </div>

      <nav className="flex gap-1 border-b border-border px-3 py-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                isActive
                  ? "bg-brand-cyan/15 text-brand-cyan"
                  : "text-text-secondary hover:bg-background-elevated hover:text-text-primary"
              )
            }
          >
            <item.icon className="h-3.5 w-3.5" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="min-h-0 flex-1 overflow-hidden">
        <MemberQuickNav />
      </div>

      <div className="border-t border-border p-3">
        <button
          type="button"
          onClick={toggleRightPanel}
          disabled={rightPanelOpen}
          className={cn(
            "btn-secondary w-full justify-center py-2 text-xs",
            rightPanelOpen && "opacity-40"
          )}
        >
          <PanelRightOpen className="h-3.5 w-3.5" />
          {rightPanelOpen ? "面板已展开" : "展开数据面板"}
        </button>
      </div>
    </aside>
  );
}
