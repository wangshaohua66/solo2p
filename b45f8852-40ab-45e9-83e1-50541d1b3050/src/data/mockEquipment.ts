import type { Equipment, EquipmentType, Substation } from '@/types';
import { substations } from './mockSubstations';

function seedRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const rand = seedRandom(12345);

function randomInRange(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

function generateEquipmentsForStation(
  substation: Substation,
  counters: { tf: number; br: number; bb: number }
): Equipment[] {
  const result: Equipment[] = [];
  const { voltageLevel, id: subId, capacity } = substation;

  if (voltageLevel === '500kV') {
    const tfIds: string[] = [];
    const bbIds: string[] = [];
    const brIds: string[] = [];

    for (let i = 0; i < 4; i++) {
      counters.tf++;
      const tfId = `eq-tf-5${String(counters.tf).padStart(4, '0')}`;
      tfIds.push(tfId);
    }
    for (let i = 0; i < 4; i++) {
      counters.bb++;
      const bbId = `eq-bb-5${String(counters.bb).padStart(4, '0')}`;
      bbIds.push(bbId);
    }
    for (let i = 0; i < 4; i++) {
      counters.br++;
      const brId = `eq-br-5${String(counters.br).padStart(4, '0')}`;
      brIds.push(brId);
    }

    const tfCapacity = Math.round(capacity / 4);
    for (let i = 0; i < 4; i++) {
      const children: string[] = [];
      if (i === 0) { children.push(bbIds[0], bbIds[1]); }
      else if (i === 1) { children.push(bbIds[2], bbIds[3]); }
      else if (i === 2) { children.push(brIds[0], brIds[1]); }
      else if (i === 3) { children.push(brIds[2], brIds[3]); }

      result.push({
        id: tfIds[i],
        name: `${i + 1}号主变压器`,
        type: 'transformer',
        substationId: subId,
        children,
        ratedCapacity: tfCapacity + randomInRange(-50, 50),
      });
    }

    for (let i = 0; i < 4; i++) {
      const parentIdx = i < 2 ? 0 : 1;
      result.push({
        id: bbIds[i],
        name: `500kV ${romanNumeral(i + 1)}段母线`,
        type: 'busbar',
        substationId: subId,
        parentId: tfIds[parentIdx],
      });
    }

    for (let i = 0; i < 4; i++) {
      const parentIdx = i < 2 ? 2 : 3;
      result.push({
        id: brIds[i],
        name: `${i + 1}号500kV断路器`,
        type: 'breaker',
        substationId: subId,
        parentId: tfIds[parentIdx],
      });
    }
  } else if (voltageLevel === '220kV') {
    const tfIds: string[] = [];
    const bbIds: string[] = [];
    const brIds: string[] = [];

    for (let i = 0; i < 3; i++) {
      counters.tf++;
      const tfId = `eq-tf-2${String(counters.tf).padStart(4, '0')}`;
      tfIds.push(tfId);
    }
    for (let i = 0; i < 2; i++) {
      counters.bb++;
      const bbId = `eq-bb-2${String(counters.bb).padStart(4, '0')}`;
      bbIds.push(bbId);
    }
    for (let i = 0; i < 3; i++) {
      counters.br++;
      const brId = `eq-br-2${String(counters.br).padStart(4, '0')}`;
      brIds.push(brId);
    }

    const tfCapacity = Math.round(capacity / 3);
    for (let i = 0; i < 3; i++) {
      const children: string[] = [];
      if (i === 0) { children.push(bbIds[0], bbIds[1]); }
      else if (i === 1) { children.push(brIds[0], brIds[1]); }
      else if (i === 2) { children.push(brIds[2]); }

      result.push({
        id: tfIds[i],
        name: `${i + 1}号主变压器`,
        type: 'transformer',
        substationId: subId,
        children,
        ratedCapacity: tfCapacity + randomInRange(-20, 20),
      });
    }

    for (let i = 0; i < 2; i++) {
      result.push({
        id: bbIds[i],
        name: `220kV ${romanNumeral(i + 1)}段母线`,
        type: 'busbar',
        substationId: subId,
        parentId: tfIds[0],
      });
    }

    for (let i = 0; i < 3; i++) {
      const parentIdx = i < 2 ? 1 : 2;
      result.push({
        id: brIds[i],
        name: `${i + 1}号220kV断路器`,
        type: 'breaker',
        substationId: subId,
        parentId: tfIds[parentIdx],
      });
    }
  } else {
    const tfIds: string[] = [];
    const bbIds: string[] = [];
    const brIds: string[] = [];

    for (let i = 0; i < 2; i++) {
      counters.tf++;
      const tfId = `eq-tf-1${String(counters.tf).padStart(4, '0')}`;
      tfIds.push(tfId);
    }
    counters.bb++;
    const bbId = `eq-bb-1${String(counters.bb).padStart(4, '0')}`;
    bbIds.push(bbId);
    for (let i = 0; i < 2; i++) {
      counters.br++;
      const brId = `eq-br-1${String(counters.br).padStart(4, '0')}`;
      brIds.push(brId);
    }

    const tfCapacity = Math.round(capacity / 2);
    for (let i = 0; i < 2; i++) {
      const children: string[] = [];
      if (i === 0) { children.push(bbIds[0]); }
      else if (i === 1) { children.push(brIds[0], brIds[1]); }

      result.push({
        id: tfIds[i],
        name: `${i + 1}号主变压器`,
        type: 'transformer',
        substationId: subId,
        children,
        ratedCapacity: tfCapacity + randomInRange(-10, 10),
      });
    }

    result.push({
      id: bbIds[0],
      name: '110kV 母线',
      type: 'busbar',
      substationId: subId,
      parentId: tfIds[0],
    });

    for (let i = 0; i < 2; i++) {
      result.push({
        id: brIds[i],
        name: `${i + 1}号110kV断路器`,
        type: 'breaker',
        substationId: subId,
        parentId: tfIds[1],
      });
    }
  }

  return result;
}

function romanNumeral(n: number): string {
  const romans = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  return romans[n - 1] || String(n);
}

function generateEquipments(): { equipments: Equipment[]; stationEquipmentMap: Record<string, Equipment[]> } {
  const counters = { tf: 0, br: 0, bb: 0 };
  const allEquipments: Equipment[] = [];
  const stationMap: Record<string, Equipment[]> = {};

  for (const sub of substations) {
    const stationEquipments = generateEquipmentsForStation(sub, counters);
    allEquipments.push(...stationEquipments);
    stationMap[sub.id] = stationEquipments;
  }

  return { equipments: allEquipments, stationEquipmentMap: stationMap };
}

const { equipments, stationEquipmentMap } = generateEquipments();

export { equipments, stationEquipmentMap };
export const mockEquipment: Equipment[] = equipments;
