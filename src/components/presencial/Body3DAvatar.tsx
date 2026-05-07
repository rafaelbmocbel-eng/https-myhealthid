import { Suspense, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html, useGLTF, Center, Bounds } from '@react-three/drei';
import * as THREE from 'three';

// Manequim anatômico (figura humana neutra estilo manequim médico)
const HUMAN_MODEL_URL = 'https://models.readyplayer.me/64bfa15f0e72c63d7c3934a6.glb?meshLod=2&textureAtlas=512';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Trash2, RotateCcw } from 'lucide-react';

export type PainPoint = {
  region: string;
  x: number;
  y: number;
  z: number;
  intensity: number; // 0-10
};

const REGIONS: { key: string; label: string; pos: [number, number, number] }[] = [
  { key: 'cabeca', label: 'Cabeça', pos: [0, 1.75, 0] },
  { key: 'cervical', label: 'Cervical', pos: [0, 1.45, -0.05] },
  { key: 'ombro_d', label: 'Ombro D', pos: [-0.32, 1.3, 0] },
  { key: 'ombro_e', label: 'Ombro E', pos: [0.32, 1.3, 0] },
  { key: 'cotovelo_d', label: 'Cotovelo D', pos: [-0.42, 0.95, 0] },
  { key: 'cotovelo_e', label: 'Cotovelo E', pos: [0.42, 0.95, 0] },
  { key: 'punho_d', label: 'Punho D', pos: [-0.45, 0.6, 0] },
  { key: 'punho_e', label: 'Punho E', pos: [0.45, 0.6, 0] },
  { key: 'toracica', label: 'Torácica', pos: [0, 1.15, -0.1] },
  { key: 'lombar', label: 'Lombar', pos: [0, 0.85, -0.12] },
  { key: 'quadril_d', label: 'Quadril D', pos: [-0.13, 0.7, 0] },
  { key: 'quadril_e', label: 'Quadril E', pos: [0.13, 0.7, 0] },
  { key: 'joelho_d', label: 'Joelho D', pos: [-0.13, 0.35, 0.05] },
  { key: 'joelho_e', label: 'Joelho E', pos: [0.13, 0.35, 0.05] },
  { key: 'tornozelo_d', label: 'Tornozelo D', pos: [-0.13, 0.05, 0.05] },
  { key: 'tornozelo_e', label: 'Tornozelo E', pos: [0.13, 0.05, 0.05] },
];

function intensityColor(i: number): string {
  if (i <= 0) return '#94a3b8';
  if (i <= 3) return '#22c55e';
  if (i <= 6) return '#eab308';
  if (i <= 8) return '#f97316';
  return '#ef4444';
}

function HumanModel() {
  const { scene } = useGLTF(HUMAN_MODEL_URL) as any;
  const cloned = useMemo(() => {
    const c = scene.clone(true);
    // Aplica material de manequim anatômico (branco fosco médico)
    const mannequinMat = new THREE.MeshStandardMaterial({
      color: '#e8e4dd',
      roughness: 0.85,
      metalness: 0.0,
    });
    c.traverse((obj: any) => {
      if (obj.isMesh) {
        obj.material = mannequinMat;
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
    return c;
  }, [scene]);
  return <primitive object={cloned} />;
}
useGLTF.preload(HUMAN_MODEL_URL);

function HumanBody({
  points,
  selected,
  onSelectRegion,
}: {
  points: Record<string, number>;
  selected: string | null;
  onSelectRegion: (key: string) => void;
}) {
  return (
    <group>
      <Center>
        <Suspense fallback={null}>
          <HumanModel />
        </Suspense>
      </Center>

      {/* Region markers */}
      {REGIONS.map((r) => {
        const intensity = points[r.key] ?? 0;
        const isSel = selected === r.key;
        const color = intensity > 0 ? intensityColor(intensity) : isSel ? '#3b82f6' : '#cbd5e1';
        const radius = intensity > 0 ? 0.04 + intensity * 0.006 : 0.035;
        return (
          <mesh
            key={r.key}
            position={r.pos}
            onClick={(e) => {
              e.stopPropagation();
              onSelectRegion(r.key);
            }}
            onPointerOver={(e) => {
              e.stopPropagation();
              document.body.style.cursor = 'pointer';
            }}
            onPointerOut={() => {
              document.body.style.cursor = 'auto';
            }}
          >
            <sphereGeometry args={[radius, 16, 16]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={intensity > 0 ? 0.5 : isSel ? 0.4 : 0.1}
              transparent
              opacity={intensity > 0 ? 0.95 : 0.65}
            />
            {(isSel || intensity > 0) && (
              <Html distanceFactor={5} center style={{ pointerEvents: 'none' }}>
                <div className="px-1.5 py-0.5 rounded-md bg-background/90 border border-border text-[9px] font-bold whitespace-nowrap shadow-sm">
                  {r.label}
                  {intensity > 0 && <span className="ml-1 text-primary">{intensity}</span>}
                </div>
              </Html>
            )}
          </mesh>
        );
      })}
    </group>
  );
}

function AutoSpinner({ enabled, groupRef }: { enabled: boolean; groupRef: React.MutableRefObject<THREE.Group | null> }) {
  useFrame(() => {
    if (enabled && groupRef.current) groupRef.current.rotation.y += 0.003;
  });
  return null;
}

interface Props {
  value?: Record<string, number>;
  onChange?: (map: Record<string, number>) => void;
}

export default function Body3DAvatar({ value, onChange }: Props) {
  const [internal, setInternal] = useState<Record<string, number>>(value ?? {});
  const points = value ?? internal;
  const [selected, setSelected] = useState<string | null>(null);
  const [autoSpin, setAutoSpin] = useState(false);
  const groupRef = useRef<THREE.Group | null>(null);

  const update = (map: Record<string, number>) => {
    setInternal(map);
    onChange?.(map);
  };

  const setIntensity = (key: string, v: number) => {
    const next = { ...points };
    if (v <= 0) delete next[key];
    else next[key] = v;
    update(next);
  };

  const clearAll = () => {
    update({});
    setSelected(null);
  };

  const selectedLabel = REGIONS.find((r) => r.key === selected)?.label;
  const selectedIntensity = selected ? points[selected] ?? 0 : 0;
  const activeRegions = Object.entries(points).filter(([, v]) => v > 0);

  return (
    <div className="space-y-3">
      <div className="relative rounded-2xl overflow-hidden border border-border bg-gradient-to-b from-muted/30 to-muted/10" style={{ height: 360 }}>
        <Canvas camera={{ position: [0, 1, 4], fov: 35 }} dpr={[1, 2]}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[2, 3, 4]} intensity={0.8} />
          <directionalLight position={[-2, 1, -2]} intensity={0.3} />
          <Suspense fallback={null}>
            <Bounds fit clip observe margin={1.2}>
              <group ref={groupRef}>
                <HumanBody points={points} selected={selected} onSelectRegion={setSelected} />
              </group>
            </Bounds>
            <AutoSpinner enabled={autoSpin} groupRef={groupRef} />
          </Suspense>
          <OrbitControls enablePan={false} minDistance={1.6} maxDistance={6} />
        </Canvas>
        <div className="absolute top-2 right-2 flex gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-7 text-[10px] gap-1"
            onClick={() => setAutoSpin((s) => !s)}
          >
            <RotateCcw className="h-3 w-3" />
            {autoSpin ? 'Parar' : 'Girar'}
          </Button>
          {activeRegions.length > 0 && (
            <Button type="button" size="sm" variant="destructive" className="h-7 text-[10px] gap-1" onClick={clearAll}>
              <Trash2 className="h-3 w-3" /> Limpar
            </Button>
          )}
        </div>
        <div className="absolute bottom-2 left-2 text-[10px] text-muted-foreground bg-background/70 backdrop-blur px-2 py-1 rounded-md">
          Arraste para girar · Clique numa região
        </div>
      </div>

      {selected ? (
        <div className="rounded-xl border border-border bg-card p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Região selecionada</p>
              <p className="font-bold text-sm">{selectedLabel}</p>
            </div>
            <div
              className="h-9 w-9 rounded-full flex items-center justify-center text-white font-black text-sm"
              style={{ background: intensityColor(selectedIntensity) }}
            >
              {selectedIntensity}
            </div>
          </div>
          <Slider
            value={[selectedIntensity]}
            min={0}
            max={10}
            step={1}
            onValueChange={(v) => setIntensity(selected, v[0])}
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Sem dor</span>
            <span>Insuportável</span>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center">Clique em uma região do avatar para registrar a dor (0–10).</p>
      )}

      {activeRegions.length > 0 && (
        <div className="rounded-xl border border-border bg-muted/20 p-3">
          <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-2">
            Mapa de Dor ({activeRegions.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {activeRegions
              .sort((a, b) => b[1] - a[1])
              .map(([k, v]) => {
                const r = REGIONS.find((rr) => rr.key === k);
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setSelected(k)}
                    className="px-2 py-1 rounded-full text-[10px] font-bold text-white inline-flex items-center gap-1"
                    style={{ background: intensityColor(v) }}
                  >
                    {r?.label ?? k} · {v}
                  </button>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}

export function painMapToText(map: Record<string, number>): string {
  const entries = Object.entries(map).filter(([, v]) => v > 0);
  if (!entries.length) return '';
  const sorted = entries.sort((a, b) => b[1] - a[1]);
  const lines = sorted.map(([k, v]) => {
    const label = REGIONS.find((r) => r.key === k)?.label ?? k;
    return `- ${label}: ${v}/10`;
  });
  return `Mapa de dor (avatar 3D):\n${lines.join('\n')}`;
}
