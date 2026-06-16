import React, { useState, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  useDroppable,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useProjectStore } from '@/stores/projectStore';
import { Shot, Scene } from '@/types';

const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    className={`transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
  >
    <path d="M9 18l6-6-6-6" />
  </svg>
);

const SceneIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
  </svg>
);

const ShotIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <path d="M21 15l-5-5L5 21" />
  </svg>
);

interface SortableSceneProps {
  scene: Scene;
  shots: Shot[];
  isActive: boolean;
  onSelect: (id: string) => void;
  onSelectScene: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onAddShot: (sceneId: string) => void;
  onDeleteScene: (id: string) => void;
  expandedScenes: Set<string>;
  toggleScene: (id: string) => void;
}

const SortableScene: React.FC<SortableSceneProps> = ({
  scene,
  shots,
  isActive,
  onSelect,
  onSelectScene,
  onRename,
  onAddShot,
  onDeleteScene,
  expandedScenes,
  toggleScene,
}) => {
  const [isRenaming, setIsRenaming] = useState(false);
  const [nameInput, setNameInput] = useState(scene.name);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `scene-${scene.id}`,
    data: {
      type: 'scene',
      scene,
    },
  });

  const { setNodeRef: setDroppableRef } = useDroppable({
    id: `scene-drop-${scene.id}`,
    data: { type: 'scene-drop', sceneId: scene.id },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 2 : 1,
  };

  const expanded = expandedScenes.has(scene.id);

  const saveRename = () => {
    if (nameInput.trim()) {
      onRename(scene.id, nameInput.trim());
    } else {
      setNameInput(scene.name);
    }
    setIsRenaming(false);
  };

  return (
    <div ref={setNodeRef} style={style} className="mb-1">
      <div
        className={`group flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer transition-all duration-200 hover:bg-white/5 ${
          isActive ? 'bg-white/10 border-l-2 border-[#7c3aed]' : 'border-l-2 border-transparent'
        }`}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleScene(scene.id);
          }}
          className="text-gray-500 hover:text-gray-300 p-0.5 -ml-1"
        >
          <ChevronIcon open={expanded} />
        </button>
        <span className="text-gray-400 flex-shrink-0">
          <SceneIcon />
        </span>
        <div
          className="flex-1 flex items-center cursor-grab active:cursor-grabbing select-none"
          {...attributes}
          {...listeners}
          onClick={() => onSelectScene(scene.id)}
        >
          {isRenaming ? (
            <input
              autoFocus
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onBlur={saveRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveRename();
                if (e.key === 'Escape') {
                  setNameInput(scene.name);
                  setIsRenaming(false);
                }
              }}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 bg-white/10 border border-[#7c3aed] rounded px-2 py-0.5 text-sm text-gray-100 outline-none w-full"
            />
          ) : (
            <span className="text-sm text-gray-100 truncate flex-1">{scene.name}</span>
          )}
        </div>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsRenaming(true);
            }}
            title="重命名"
            className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-gray-100"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddShot(scene.id);
            }}
            title="新增分镜"
            className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-[#7c3aed]"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`删除场景「${scene.name}」？（含 ${shots.length} 个分镜）`)) {
                onDeleteScene(scene.id);
              }
            }}
            title="删除场景"
            className="p-1 rounded hover:bg-red-500/20 text-gray-400 hover:text-red-400"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
            </svg>
          </button>
        </div>
      </div>

      {expanded && (
        <div ref={setDroppableRef} className="ml-4 mt-1 space-y-0.5 min-h-[4px]">
          <SortableContext items={shots.map((s) => `shot-${s.id}`)} strategy={verticalListSortingStrategy}>
            {shots.map((shot) => (
              <SortableShotItem
                key={shot.id}
                shot={shot}
                onClick={() => onSelect(shot.id)}
                isActive={isActive && useProjectStore.getState().currentShotId === shot.id}
              />
            ))}
          </SortableContext>
        </div>
      )}
    </div>
  );
};

interface SortableShotItemProps {
  shot: Shot;
  onClick: () => void;
  isActive: boolean;
}

const SortableShotItem: React.FC<SortableShotItemProps> = ({ shot, onClick, isActive }) => {
  const deleteShot = useProjectStore((s) => s.deleteShot);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `shot-${shot.id}`,
    data: {
      type: 'shot',
      shot,
      sourceSceneId: shot.sceneId,
    },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 2 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-all duration-200 hover:bg-white/5 active:scale-[0.98] ${
        isActive ? 'bg-[#7c3aed]/20 border-l-2 border-[#7c3aed]' : 'border-l-2 border-transparent'
      }`}
      onClick={onClick}
    >
      <span
        className="text-gray-500 flex-shrink-0 cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <ShotIcon />
      </span>
      <span className="text-xs text-gray-300 truncate flex-1 select-none">
        {shot.orderIndex + 1}. {shot.title || `分镜 ${shot.orderIndex + 1}`}
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (confirm(`删除该分镜？`)) deleteShot(shot.id);
        }}
        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-all"
        title="删除分镜"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};

export const SceneTree: React.FC = () => {
  const scenes = useProjectStore((s) => s.scenes);
  const shots = useProjectStore((s) => s.shots);
  const currentShotId = useProjectStore((s) => s.currentShotId);
  const currentSceneId = useProjectStore((s) => s.currentSceneId);
  const selectShot = useProjectStore((s) => s.selectShot);
  const selectScene = useProjectStore((s) => s.selectScene);
  const addScene = useProjectStore((s) => s.addScene);
  const renameScene = useProjectStore((s) => s.renameScene);
  const deleteScene = useProjectStore((s) => s.deleteScene);
  const addShot = useProjectStore((s) => s.addShot);
  const reorderScenes = useProjectStore((s) => s.reorderScenes);
  const reorderShotInScene = useProjectStore((s) => s.reorderShotInScene);
  const moveShotToScene = useProjectStore((s) => s.moveShotToScene);

  const [expandedScenes, setExpandedScenes] = useState<Set<string>>(
    () => new Set(scenes.slice(0, 3).map((s) => s.id))
  );
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const filteredScenes = useMemo(() => {
    if (!searchTerm.trim()) return scenes;
    return scenes.filter((scene) => {
      const sceneShots = shots.filter((sh) => sh.sceneId === scene.id);
      return (
        scene.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sceneShots.some(
          (sh) =>
            (sh.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (sh.dialogues || []).some(
              (d) =>
                d.character.toLowerCase().includes(searchTerm.toLowerCase()) ||
                d.text.toLowerCase().includes(searchTerm.toLowerCase())
            )
        )
      );
    });
  }, [scenes, shots, searchTerm]);

  const toggleScene = (id: string) => {
    setExpandedScenes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDragStart = (e: DragStartEvent) => {
    setActiveDragId(String(e.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over) return;
    if (active.id === over.id) return;

    const activeType = active.data.current?.type;
    const overType = over.data.current?.type;

    if (activeType === 'scene') {
      const sceneIds = scenes.map((s) => s.id);
      const oldIndex = sceneIds.indexOf(active.data.current?.scene.id);
      const overSceneId = String(over.id).replace('scene-', '');
      let newIndex = sceneIds.indexOf(overSceneId);
      if (newIndex === -1) {
        newIndex = overType === 'scene-drop' ? sceneIds.indexOf(over.data.current?.sceneId) : -1;
      }
      if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) {
        const reordered = arrayMove(sceneIds, oldIndex, newIndex);
        reorderScenes(reordered);
      }
      return;
    }

    if (activeType === 'shot') {
      const shot = active.data.current?.shot as Shot;
      const fromSceneId = shot.sceneId;
      const sourceShots = shots.filter((s) => s.sceneId === fromSceneId).map((s) => s.id);
      const oldIndex = sourceShots.indexOf(shot.id);

      const overId = String(over.id);
      if (overType === 'scene-drop') {
        const toSceneId = over.data.current?.sceneId as string;
        if (toSceneId !== fromSceneId) {
          moveShotToScene(shot.id, fromSceneId, toSceneId, 0);
        }
        return;
      }

      if (overId.startsWith('shot-')) {
        const overShotId = overId.replace('shot-', '');
        const overShot = shots.find((s) => s.id === overShotId);
        if (!overShot) return;
        const toSceneId = overShot.sceneId;
        const targetShots = shots.filter((s) => s.sceneId === toSceneId).map((s) => s.id);
        let newIndex = targetShots.indexOf(overShotId);

        if (toSceneId === fromSceneId) {
          if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) {
            const reordered = arrayMove(sourceShots, oldIndex, newIndex);
            reorderShotInScene(fromSceneId, reordered);
          }
        } else {
          moveShotToScene(shot.id, fromSceneId, toSceneId, newIndex);
        }
      }
    }
  };

  const activeDragShot = activeDragId?.startsWith('shot-')
    ? shots.find((s) => s.id === activeDragId.replace('shot-', ''))
    : null;
  const activeDragScene = activeDragId?.startsWith('scene-')
    ? scenes.find((s) => s.id === activeDragId.replace('scene-', ''))
    : null;

  return (
    <div className="h-full flex flex-col text-sm">
      <div className="p-3 border-b border-white/10 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">场景树</h2>
          <button
            onClick={() => addScene(`第 ${scenes.length + 1} 幕`)}
            className="p-1.5 rounded-md bg-[#7c3aed] hover:bg-[#6d28d9] text-white transition-colors"
            title="新增场景"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
        <div className="relative">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="搜索场景/对白..."
            className="w-full pl-8 pr-3 py-1.5 bg-white/5 border border-white/10 rounded-md text-xs text-gray-100 placeholder-gray-500 outline-none focus:border-[#7c3aed] focus:bg-white/10 transition-colors"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto p-2">
        {filteredScenes.length === 0 ? (
          <div className="py-8 text-center text-gray-500 text-xs">
            {searchTerm ? '未找到匹配结果' : '暂无场景，点击 + 新建'}
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={filteredScenes.map((s) => `scene-${s.id}`)}
              strategy={verticalListSortingStrategy}
            >
              {filteredScenes.map((scene) => (
                <SortableScene
                  key={scene.id}
                  scene={scene}
                  shots={shots.filter((s) => s.sceneId === scene.id)}
                  isActive={currentSceneId === scene.id || currentShotId !== null}
                  onSelect={selectShot}
                  onSelectScene={selectScene}
                  onRename={renameScene}
                  onAddShot={addShot}
                  onDeleteScene={deleteScene}
                  expandedScenes={expandedScenes}
                  toggleScene={toggleScene}
                />
              ))}
            </SortableContext>

            <DragOverlay>
              {activeDragShot ? (
                <div className="bg-[#2d2d44] border border-[#7c3aed] rounded-md px-3 py-2 shadow-xl text-sm text-gray-100 flex items-center gap-2">
                  <ShotIcon />
                  <span>{activeDragShot.title || `分镜 ${activeDragShot.orderIndex + 1}`}</span>
                </div>
              ) : activeDragScene ? (
                <div className="bg-[#2d2d44] border border-[#7c3aed] rounded-md px-3 py-2 shadow-xl text-sm text-gray-100 flex items-center gap-2">
                  <SceneIcon />
                  <span>{activeDragScene.name}</span>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      <div className="p-2 border-t border-white/10 flex items-center justify-between text-xs text-gray-500">
        <span>
          {scenes.length} 场景 · {shots.length} 分镜
        </span>
      </div>
    </div>
  );
};
