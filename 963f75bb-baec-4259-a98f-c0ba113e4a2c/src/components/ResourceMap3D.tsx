import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Resource, Venue, ResourceStatus } from '@/types';
import { getStatusColor } from '@/utils/helpers';

interface ResourceMap3DProps {
  venues: Venue[];
  resources: Resource[];
  selectedResourceId: string | null;
  onSelectResource: (id: string | null) => void;
  onUpdateResourcePosition: (resourceId: string, position: { x: number; y: number; z: number }) => void;
}

interface ResourceMeshData {
  resourceId: string;
  originalPosition: THREE.Vector3;
  originalColor: THREE.Color;
}

const VENUE_LAYERS = {
  'venue-1': { y: 0, name: '主体育场', color: 0x1e3a5f },
  'venue-2': { y: 15, name: '综合体育馆', color: 0x1a2f4a },
  'venue-3': { y: 30, name: '游泳跳水馆', color: 0x0f2847 },
};

const STATUS_COLORS: Record<ResourceStatus, number> = {
  available: 0x00ff88,
  occupied: 0xff6b35,
  maintenance: 0xf59e0b,
  transitioning: 0x00d4ff,
};

const CUBE_SIZE = 1.5;

export default function ResourceMap3D({
  venues,
  resources,
  selectedResourceId,
  onSelectResource,
  onUpdateResourcePosition,
}: ResourceMap3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());
  const resourceMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const selectedMeshRef = useRef<THREE.Mesh | null>(null);
  const draggingMeshRef = useRef<THREE.Mesh | null>(null);
  const dragPlaneRef = useRef<THREE.Plane>(new THREE.Plane());
  const dragOffsetRef = useRef<THREE.Vector3>(new THREE.Vector3());
  const animationIdRef = useRef<number>(0);
  const lastClickTimeRef = useRef<number>(0);
  const [hoveredResource, setHoveredResource] = useState<Resource | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  const createVenueStructure = useCallback((scene: THREE.Scene) => {
    venues.forEach((venue) => {
      const layer = VENUE_LAYERS[venue.id as keyof typeof VENUE_LAYERS];
      if (!layer) return;

      const platformGeometry = new THREE.BoxGeometry(30, 0.5, 25);
      const platformMaterial = new THREE.MeshStandardMaterial({
        color: layer.color,
        metalness: 0.3,
        roughness: 0.7,
      });
      const platform = new THREE.Mesh(platformGeometry, platformMaterial);
      platform.position.set(0, layer.y, 0);
      platform.receiveShadow = true;
      scene.add(platform);

      const edgeGeometry = new THREE.EdgesGeometry(platformGeometry);
      const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x00d4ff, transparent: true, opacity: 0.5 });
      const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
      edges.position.copy(platform.position);
      scene.add(edges);

      const labelCanvas = document.createElement('canvas');
      labelCanvas.width = 512;
      labelCanvas.height = 128;
      const labelCtx = labelCanvas.getContext('2d')!;
      labelCtx.fillStyle = 'rgba(0, 212, 255, 0.9)';
      labelCtx.font = 'bold 48px Arial';
      labelCtx.textAlign = 'center';
      labelCtx.fillText(layer.name, 256, 70);

      const labelTexture = new THREE.CanvasTexture(labelCanvas);
      const labelMaterial = new THREE.SpriteMaterial({ map: labelTexture, transparent: true });
      const labelSprite = new THREE.Sprite(labelMaterial);
      labelSprite.position.set(0, layer.y + 8, 14);
      labelSprite.scale.set(10, 2.5, 1);
      scene.add(labelSprite);
    });

    const pillarGeometry = new THREE.CylinderGeometry(0.3, 0.3, 30, 8);
    const pillarMaterial = new THREE.MeshStandardMaterial({
      color: 0x2d5a87,
      metalness: 0.5,
      roughness: 0.5,
    });

    [[-14, 14], [14, 14], [-14, -14], [14, -14]].forEach(([x, z]) => {
      const pillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
      pillar.position.set(x, 15, z);
      pillar.castShadow = true;
      scene.add(pillar);
    });
  }, [venues]);

  const createGridGround = useCallback((scene: THREE.Scene) => {
    const gridHelper = new THREE.GridHelper(100, 50, 0x00d4ff, 0x1e3a5f);
    gridHelper.position.y = -2;
    gridHelper.material.transparent = true;
    gridHelper.material.opacity = 0.3;
    scene.add(gridHelper);

    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x0a1628,
      transparent: true,
      opacity: 0.5,
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -2.1;
    ground.receiveShadow = true;
    scene.add(ground);
  }, []);

  const createLighting = useCallback((scene: THREE.Scene) => {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
    mainLight.position.set(20, 40, 20);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 100;
    mainLight.shadow.camera.left = -50;
    mainLight.shadow.camera.right = 50;
    mainLight.shadow.camera.top = 50;
    mainLight.shadow.camera.bottom = -50;
    scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0x00d4ff, 0.3);
    fillLight.position.set(-20, 20, -20);
    scene.add(fillLight);

    venues.forEach((venue, index) => {
      const layer = VENUE_LAYERS[venue.id as keyof typeof VENUE_LAYERS];
      if (!layer) return;

      const pointLight = new THREE.PointLight(0x00d4ff, 0.5, 30);
      pointLight.position.set(0, layer.y + 5, 0);
      scene.add(pointLight);
    });
  }, [venues]);

  const createResourceNode = useCallback((scene: THREE.Scene, resource: Resource) => {
    const layer = VENUE_LAYERS[resource.venueId as keyof typeof VENUE_LAYERS];
    if (!layer) return;

    const x = (resource.position.x - 50) / 4;
    const z = (resource.position.y - 50) / 4;
    const y = layer.y + 1.5;

    const geometry = new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE);
    const color = STATUS_COLORS[resource.status] || 0x6b7280;
    const material = new THREE.MeshStandardMaterial({
      color,
      metalness: 0.4,
      roughness: 0.3,
      emissive: color,
      emissiveIntensity: 0.2,
    });

    const cube = new THREE.Mesh(geometry, material);
    cube.position.set(x, y, z);
    cube.castShadow = true;
    cube.receiveShadow = true;

    const edgeGeometry = new THREE.EdgesGeometry(geometry);
    const edgeMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 });
    const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
    cube.add(edges);

    (cube as unknown as unknown as THREE.Mesh & { userData: ResourceMeshData }).userData = {
      resourceId: resource.id,
      originalPosition: cube.position.clone(),
      originalColor: new THREE.Color(color),
    };

    scene.add(cube);
    resourceMeshesRef.current.set(resource.id, cube);
  }, []);

  const updateResourceVisuals = useCallback((resource: Resource) => {
    const mesh = resourceMeshesRef.current.get(resource.id);
    if (!mesh) return;

    const material = mesh.material as THREE.MeshStandardMaterial;
    const color = STATUS_COLORS[resource.status] || 0x6b7280;
    material.color.setHex(color);
    material.emissive.setHex(color);

    const userData = (mesh as unknown as unknown as THREE.Mesh & { userData: ResourceMeshData }).userData;
    userData.originalColor.setHex(color);

    if (selectedResourceId === resource.id) {
      material.emissiveIntensity = 0.6;
      mesh.scale.setScalar(1.2);
      selectedMeshRef.current = mesh;
    } else {
      material.emissiveIntensity = 0.2;
      mesh.scale.setScalar(1);
    }
  }, [selectedResourceId]);

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!containerRef.current || !cameraRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    if (draggingMeshRef.current && controlsRef.current) {
      controlsRef.current.enabled = false;
      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);

      const intersection = new THREE.Vector3();
      if (raycasterRef.current.ray.intersectPlane(dragPlaneRef.current, intersection)) {
        draggingMeshRef.current.position.copy(intersection.sub(dragOffsetRef.current));
      }
      return;
    }

    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
    const meshes = Array.from(resourceMeshesRef.current.values());
    const intersects = raycasterRef.current.intersectObjects(meshes);

    if (intersects.length > 0) {
      const mesh = intersects[0].object as unknown as THREE.Mesh & { userData: ResourceMeshData };
      const resource = resources.find(r => r.id === mesh.userData.resourceId);
      if (resource) {
        setHoveredResource(resource);
        setTooltipPosition({ x: event.clientX, y: event.clientY });
        document.body.style.cursor = 'pointer';
      }
    } else {
      setHoveredResource(null);
      document.body.style.cursor = 'default';
    }
  }, [resources]);

  const handleMouseDown = useCallback((event: MouseEvent) => {
    if (!cameraRef.current || event.button !== 0) return;

    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
    const meshes = Array.from(resourceMeshesRef.current.values());
    const intersects = raycasterRef.current.intersectObjects(meshes);

    if (intersects.length > 0) {
      const mesh = intersects[0].object as unknown as THREE.Mesh & { userData: ResourceMeshData };
      draggingMeshRef.current = mesh;

      const normal = new THREE.Vector3(0, 1, 0);
      dragPlaneRef.current.setFromNormalAndCoplanarPoint(
        normal,
        mesh.position
      );

      const intersection = new THREE.Vector3();
      raycasterRef.current.ray.intersectPlane(dragPlaneRef.current, intersection);
      dragOffsetRef.current.copy(intersection).sub(mesh.position);
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    if (draggingMeshRef.current && controlsRef.current) {
      controlsRef.current.enabled = true;

      const mesh = draggingMeshRef.current as unknown as THREE.Mesh & { userData: ResourceMeshData };
      const resourceId = mesh.userData.resourceId;

      const layer = VENUE_LAYERS[resources.find(r => r.id === resourceId)?.venueId as keyof typeof VENUE_LAYERS];
      if (layer) {
        mesh.position.y = layer.y + 1.5;
      }

      const newX = Math.round(mesh.position.x * 4 + 50);
      const newY = Math.round(mesh.position.z * 4 + 50);
      const newZ = Math.round((mesh.position.y - (layer?.y || 0) - 1.5) * 10) / 10;

      onUpdateResourcePosition(resourceId, { x: newX, y: newY, z: newZ });
      mesh.userData.originalPosition.copy(mesh.position);

      draggingMeshRef.current = null;
    }
  }, [resources, onUpdateResourcePosition]);

  const handleDoubleClick = useCallback((event: MouseEvent) => {
    if (!cameraRef.current) return;

    const now = Date.now();
    if (now - lastClickTimeRef.current < 300) {
      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
      const meshes = Array.from(resourceMeshesRef.current.values());
      const intersects = raycasterRef.current.intersectObjects(meshes);

      if (intersects.length > 0) {
        const mesh = intersects[0].object as unknown as THREE.Mesh & { userData: ResourceMeshData };
        onSelectResource(mesh.userData.resourceId);
      } else {
        onSelectResource(null);
      }
    }
    lastClickTimeRef.current = now;
  }, [onSelectResource]);

  const handleWheel = useCallback((event: WheelEvent) => {
    event.stopPropagation();
  }, []);

  const animate = useCallback(() => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;

    const time = Date.now() * 0.001;

    resourceMeshesRef.current.forEach((mesh, resourceId) => {
      const resource = resources.find(r => r.id === resourceId);
      if (!resource) return;

      if (selectedResourceId === resourceId) {
        mesh.position.y += Math.sin(time * 3) * 0.005;
      }

      if (resource.status === 'maintenance') {
        const material = mesh.material as THREE.MeshStandardMaterial;
        material.emissiveIntensity = 0.3 + Math.sin(time * 5) * 0.2;
      }
    });

    controlsRef.current?.update();
    rendererRef.current.render(sceneRef.current, cameraRef.current);
    animationIdRef.current = requestAnimationFrame(animate);
  }, [resources, selectedResourceId]);

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a1628);
    scene.fog = new THREE.Fog(0x0a1628, 50, 120);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      60,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(35, 45, 35);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 15;
    controls.maxDistance = 100;
    controls.maxPolarAngle = Math.PI / 2.1;
    controls.target.set(0, 15, 0);
    controlsRef.current = controls;

    createGridGround(scene);
    createLighting(scene);
    createVenueStructure(scene);
    resources.forEach(resource => createResourceNode(scene, resource));

    renderer.domElement.addEventListener('mousemove', handleMouseMove);
    renderer.domElement.addEventListener('mousedown', handleMouseDown);
    renderer.domElement.addEventListener('mouseup', handleMouseUp);
    renderer.domElement.addEventListener('mouseleave', handleMouseUp);
    renderer.domElement.addEventListener('dblclick', handleDoubleClick);
    renderer.domElement.addEventListener('wheel', handleWheel, { passive: false });

    const handleResize = () => {
      if (!containerRef.current) return;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    animate();

    return () => {
      cancelAnimationFrame(animationIdRef.current);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('mousemove', handleMouseMove);
      renderer.domElement.removeEventListener('mousedown', handleMouseDown);
      renderer.domElement.removeEventListener('mouseup', handleMouseUp);
      renderer.domElement.removeEventListener('mouseleave', handleMouseUp);
      renderer.domElement.removeEventListener('dblclick', handleDoubleClick);
      renderer.domElement.removeEventListener('wheel', handleWheel);
      renderer.dispose();
      if (containerRef.current && renderer.domElement.parentNode === containerRef.current) {
        containerRef.current.removeChild(renderer.domElement);
      }
      resourceMeshesRef.current.clear();
    };
  }, [venues, resources, createGridGround, createLighting, createVenueStructure, createResourceNode, handleMouseMove, handleMouseDown, handleMouseUp, handleDoubleClick, handleWheel, animate]);

  useEffect(() => {
    resources.forEach(resource => {
      const mesh = resourceMeshesRef.current.get(resource.id);
      if (mesh) {
        const layer = VENUE_LAYERS[resource.venueId as keyof typeof VENUE_LAYERS];
        if (layer) {
          const x = (resource.position.x - 50) / 4;
          const z = (resource.position.y - 50) / 4;
          const y = layer.y + 1.5;
          mesh.position.set(x, y, z);
          (mesh as unknown as THREE.Mesh & { userData: ResourceMeshData }).userData.originalPosition.set(x, y, z);
        }
      }
      updateResourceVisuals(resource);
    });
  }, [resources, updateResourceVisuals]);

  const getStatusName = (status: ResourceStatus) => {
    const names: Record<ResourceStatus, string> = {
      available: '可用',
      occupied: '占用',
      maintenance: '维护',
      transitioning: '保留',
    };
    return names[status] || status;
  };

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />

      {hoveredResource && (
        <div
          className="fixed z-50 bg-slate-900/95 backdrop-blur border border-cyan-500/30 rounded-xl p-3 shadow-2xl pointer-events-none"
          style={{
            left: tooltipPosition.x + 15,
            top: tooltipPosition.y + 15,
            minWidth: '200px',
          }}
        >
          <div className="font-semibold text-white text-sm">{hoveredResource.name}</div>
          <div className="text-xs text-slate-400 mt-1">{hoveredResource.category}</div>
          <div className="flex items-center gap-2 mt-2">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: getStatusColor(hoveredResource.status) }}
            />
            <span className="text-xs" style={{ color: getStatusColor(hoveredResource.status) }}>
              {getStatusName(hoveredResource.status)}
            </span>
          </div>
          {hoveredResource.capacity > 0 && (
            <div className="text-xs text-slate-400 mt-1">
              容量: {hoveredResource.capacity.toLocaleString()} 人
            </div>
          )}
          <div className="text-xs text-slate-500 mt-2">
            双击选中 · 拖拽调整位置
          </div>
        </div>
      )}

      <div className="absolute bottom-4 left-4 bg-slate-900/80 backdrop-blur rounded-xl px-3 py-2 border border-slate-700/50 text-xs text-slate-400 space-y-1">
        <div>🖱️ 拖拽旋转场景</div>
        <div>🔍 滚轮缩放</div>
        <div>👆 双击选中节点</div>
        <div>✋ 拖拽节点调整位置</div>
      </div>
    </div>
  );
}
