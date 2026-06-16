import { ref, computed } from 'vue';
import { useApronStore } from '@/stores/apron';
import { ZOOM_RANGE, SVG_VIEWBOX } from '@/utils/constants';
import type { Position } from '@/types/apron';
import { clamp } from '@/utils/helpers';

export function useApronMap() {
  const store = useApronStore();
  const svgElement = ref<SVGSVGElement | null>(null);
  const isDragging = ref(false);
  const lastPan = ref<Position>({ x: 0, y: 0 });
  const dragStart = ref<Position>({ x: 0, y: 0 });

  const transform = computed(() => {
    const { zoom, pan } = store.layoutConfig;
    return `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;
  });

  const handleZoom = (delta: number, center?: Position) => {
    const oldZoom = store.layoutConfig.zoom;
    const newZoom = clamp(
      oldZoom + delta * 0.1,
      ZOOM_RANGE.min,
      ZOOM_RANGE.max
    );

    if (center && svgElement.value) {
      const rect = svgElement.value.getBoundingClientRect();
      const mouseX = center.x - rect.left;
      const mouseY = center.y - rect.top;

      const scaleChange = newZoom / oldZoom;
      const newPanX = mouseX - (mouseX - store.layoutConfig.pan.x) * scaleChange;
      const newPanY = mouseY - (mouseY - store.layoutConfig.pan.y) * scaleChange;

      store.setZoom(newZoom);
      store.setPan({ x: newPanX, y: newPanY });
    } else {
      store.setZoom(newZoom);
    }
  };

  const handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -1 : 1;
    handleZoom(delta, { x: e.clientX, y: e.clientY });
  };

  const handleMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return;
    isDragging.value = true;
    dragStart.value = { x: e.clientX, y: e.clientY };
    lastPan.value = { ...store.layoutConfig.pan };
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging.value) return;

    const dx = e.clientX - dragStart.value.x;
    const dy = e.clientY - dragStart.value.y;

    store.setPan({
      x: lastPan.value.x + dx,
      y: lastPan.value.y + dy,
    });
  };

  const handleMouseUp = () => {
    isDragging.value = false;
  };

  const handleMouseLeave = () => {
    isDragging.value = false;
  };

  const handleStandClick = (standId: string) => {
    if (store.selectedStandId === standId) {
      store.setSelectedStand(null);
    } else {
      store.setSelectedStand(standId);
    }
  };

  const centerOnStand = (standId: string) => {
    const stand = store.standById(standId);
    if (!stand || !svgElement.value) return;

    const rect = svgElement.value.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const standCenterX = stand.position.x + stand.position.width / 2;
    const standCenterY = stand.position.y + stand.position.height / 2;

    const zoom = store.layoutConfig.zoom;
    const panX = centerX - standCenterX * zoom;
    const panY = centerY - standCenterY * zoom;

    store.setPan({ x: panX, y: panY });
    store.setZoom(1.5);
    store.setSelectedStand(standId);
  };

  const resetView = () => {
    store.setZoom(ZOOM_RANGE.default);
    store.setPan({ x: 0, y: 0 });
  };

  const zoomIn = () => handleZoom(1);
  const zoomOut = () => handleZoom(-1);

  const screenToSvg = (screenX: number, screenY: number): Position | null => {
    if (!svgElement.value) return null;

    const rect = svgElement.value.getBoundingClientRect();
    const { zoom, pan } = store.layoutConfig;

    return {
      x: (screenX - rect.left - pan.x) / zoom,
      y: (screenY - rect.top - pan.y) / zoom,
    };
  };

  const setupSvgHandlers = (svg: SVGSVGElement) => {
    svgElement.value = svg;
    svg.addEventListener('wheel', handleWheel, { passive: false });
    svg.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mouseleave', handleMouseLeave);
  };

  const cleanupSvgHandlers = () => {
    if (svgElement.value) {
      svgElement.value.removeEventListener('wheel', handleWheel);
      svgElement.value.removeEventListener('mousedown', handleMouseDown);
    }
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
    window.removeEventListener('mouseleave', handleMouseLeave);
    svgElement.value = null;
  };

  return {
    svgElement,
    isDragging,
    transform,
    handleZoom,
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    handleStandClick,
    centerOnStand,
    resetView,
    zoomIn,
    zoomOut,
    screenToSvg,
    setupSvgHandlers,
    cleanupSvgHandlers,
  };
}
