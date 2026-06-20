import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Search, UserPlus, Users } from "lucide-react";
import { useMemberStore } from "@/stores/memberStore";
import { useUIStore } from "@/stores/uiStore";
import { getGoalLabel } from "@/hooks/useTrainingVolume";
import type { Member } from "@/types";
import { cn } from "@/lib/utils";
import AutoSizeList from "@/components/common/AutoSizeList";

interface RowData {
  members: Member[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

interface RowProps {
  index: number;
  style: React.CSSProperties;
  data: RowData;
}

const MemberRow = ({ index, style, data }: RowProps) => {
  const member = data.members[index];
  const isSelected = member.id === data.selectedId;
  const goalInfo = getGoalLabel(member.goal);

  return (
    <div style={style} className="px-2">
      <button
        type="button"
        onClick={() => data.onSelect(member.id)}
        className={cn(
          "group flex w-full items-center gap-3 rounded-lg border border-transparent px-2.5 py-2 text-left transition-all duration-150",
          isSelected
            ? "border-brand-cyan/40 bg-brand-cyan/10 shadow-glow"
            : "hover:border-border-muted hover:bg-background-elevated"
        )}
      >
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-sm font-semibold text-white",
            member.gender === "male"
              ? "from-brand-cyan/60 to-brand-violet/60"
              : "from-brand-rose/60 to-brand-orange/60"
          )}
        >
          {member.name.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className={cn("truncate text-sm font-medium", isSelected ? "text-brand-cyan" : "text-text-primary")}>
              {member.name}
            </span>
            <span className={cn("shrink-0 text-[10px]", goalInfo.color)}>{goalInfo.label}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-text-muted">
            <span className="font-mono">{member.height}cm</span>
            <span className="opacity-40">·</span>
            <span className="font-mono">{member.weight}kg</span>
            <span className="opacity-40">·</span>
            <span>{member.trainingRecords.length}次</span>
          </div>
        </div>
      </button>
    </div>
  );
};

export default function MemberQuickNav() {
  const navigate = useNavigate();
  const members = useMemberStore((s) => s.members);
  const selectedMemberId = useMemberStore((s) => s.selectedMemberId);
  const searchQuery = useMemberStore((s) => s.searchQuery);
  const selectedTags = useMemberStore((s) => s.selectedTags);
  const setSearchQuery = useMemberStore((s) => s.setSearchQuery);
  const setSelectedMember = useMemberStore((s) => s.setSelectedMember);
  const setAddMemberModalOpen = useUIStore((s) => s.setAddMemberModalOpen);
  const setRightPanelContent = useUIStore((s) => s.setRightPanelContent);

  const handleSelect = (id: string) => {
    setSelectedMember(id);
    setRightPanelContent("stats");
    navigate(`/members/${id}`);
  };

  const filtered = useMemo(() => {
    return members.filter((m) => {
      const matchesSearch = !searchQuery || m.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTags = selectedTags.length === 0 || selectedTags.every((t) => m.tags.includes(t));
      return matchesSearch && matchesTags;
    });
  }, [members, searchQuery, selectedTags]);

  return (
    <div className="flex h-full flex-col">
      <div className="px-3 pb-2 pt-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-brand-cyan" />
            <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">学员列表</span>
          </div>
          <span className="rounded-full bg-background-elevated px-2 py-0.5 font-mono text-[10px] text-text-muted">
            {filtered.length}/{members.length}
          </span>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索学员姓名..."
            className="input pl-8 py-1.5 text-xs"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <AutoSizeList
          itemCount={filtered.length}
          itemSize={62}
          itemData={{ members: filtered, selectedId: selectedMemberId, onSelect: handleSelect }}
          className="scrollbar-thin"
          emptyState={
            <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
              <Users className="h-8 w-8 text-text-muted" />
              <p className="text-xs text-text-muted">未找到匹配学员</p>
            </div>
          }
        >
          {MemberRow}
        </AutoSizeList>
      </div>

      <div className="border-t border-border p-3">
        <button
          type="button"
          onClick={() => setAddMemberModalOpen(true)}
          className="btn-accent w-full justify-center py-2 text-xs"
        >
          <UserPlus className="h-3.5 w-3.5" />
          新增学员
        </button>
      </div>
    </div>
  );
}
