/**
 * 房间面积回归：
 * 1. polyAreaM2 必须按多边形形状（鞋带公式）计算，矩形与 L 形都应准确；
 *    旧实现用外接矩形，L 形面积偏大。
 * 2. 图纸标注/面板/出口判定/按面积估人数同源 —— L 形房间在面积阈值（200㎡）
 *    与人数阈值（50 人）两侧的结论必须基于真实面积。
 */
import { describe, it, expect } from 'vitest';
import type { Pt } from '../src/model';
import { polyAreaM2 } from '../src/lib/geometry';
import { mkRoom, mkFloor, DEFAULT_RULES, validateFloor } from './helpers';

const M = 1000;
/** 以米为单位的多边形顶点 → 毫米 */
function polyM(coords: [number, number][]): Pt[] {
  return coords.map(([x, y]) => ({ x: x * M, y: y * M }));
}

describe('polyAreaM2 按多边形形状计算', () => {
  it('矩形面积 = 长 × 宽', () => {
    const r = polyM([[0, 0], [8, 0], [8, 6], [0, 6]]);
    expect(polyAreaM2(r)).toBeCloseTo(48, 6);
  });

  it('反向绕序面积相同（取绝对值）', () => {
    const r = polyM([[0, 0], [0, 6], [8, 6], [8, 0]]);
    expect(polyAreaM2(r)).toBeCloseTo(48, 6);
  });

  it('L 形面积 = 外接矩形 − 凹口，而不是外接矩形', () => {
    // 15×15 外接矩形挖掉右上 9×9 → 真实 144㎡，外接矩形 225㎡
    const l = polyM([[0, 0], [15, 0], [15, 6], [6, 6], [6, 15], [0, 15]]);
    expect(polyAreaM2(l)).toBeCloseTo(144, 6);
  });
});

describe('出口数量判定使用多边形真实面积', () => {
  it('L 形办公室真实 175㎡（外接矩形 225㎡）：1 个出口即够', () => {
    // 外接矩形 15×15=225 > 200；挖掉 10×5 凹口后真实 175 ≤ 200，人数估 18 ≤ 50
    const l = polyM([[0, 0], [15, 0], [15, 10], [5, 10], [5, 15], [0, 15]]);
    expect(polyAreaM2(l)).toBeCloseTo(175, 6);
    const { floor } = mkFloor(
      [mkRoom('L 形办公室', 'office', l)], // 人数留空 → 按面积估算
      [
        { kind: 'exit', x: 2, y: 2 },
        { kind: 'extinguisher', x: 7, y: 7 },
      ],
    );
    const r = validateFloor(floor, DEFAULT_RULES.office);
    expect(r.exits.required).toBe(1);
    expect(r.items.some((i) => i.type === 'EXIT_COUNT')).toBe(false);
  });

  it('L 形商铺真实 144㎡/估 48 人（外接矩形 225㎡→估 75 人）：1 个出口即够', () => {
    const l = polyM([[0, 0], [15, 0], [15, 6], [6, 6], [6, 15], [0, 15]]);
    const { floor } = mkFloor(
      [mkRoom('L 形商铺', 'retail', l)], // 商业 3㎡/人：旧逻辑 225/3=75 > 50
      [
        { kind: 'exit', x: 2, y: 2 },
        { kind: 'extinguisher', x: 7, y: 7 },
      ],
    );
    const r = validateFloor(floor, DEFAULT_RULES.retail);
    expect(r.exits.required).toBe(1);
    expect(r.items.some((i) => i.type === 'EXIT_COUNT')).toBe(false);
  });
});
