/**
 * 房间面积验收用例（沉淀自真实 bug）：
 * 1. polyAreaM2 原按外接矩形（bbox）算面积 → L 形房间虚大一块，方正房间看不出来；
 * 2. 图面标注把已经是㎡的面积又除了 1000 → 一律显示 0.0㎡，与右侧面板对不上；
 * 3. 按面积估算人数、判安全出口数量都必须用同一个多边形面积。
 */
import { describe, it, expect } from 'vitest';
import { polyAreaM2 } from '../src/lib/geometry';
import { mkRoom, mkFloor, DEFAULT_RULES, validateFloor } from './helpers';
import type { Pt } from '../src/model';

const M = 1000;
const pt = (x: number, y: number): Pt => ({ x: x * M, y: y * M });

/** 20×20 方框挖掉右下 10×10 的 L 形：bbox=400㎡，实际 300㎡ */
const L_SHAPE: Pt[] = [
  pt(0, 0),
  pt(20, 0),
  pt(20, 10),
  pt(10, 10),
  pt(10, 20),
  pt(0, 20),
];

describe('房间面积按多边形本身形状计算', () => {
  it('A1 矩形面积 = 长×宽', () => {
    expect(polyAreaM2([pt(0, 0), pt(8, 0), pt(8, 6), pt(0, 6)])).toBeCloseTo(48, 6);
  });

  it('A2 L 形房间按多边形 = 300㎡，而不是外接矩形 400㎡', () => {
    expect(polyAreaM2(L_SHAPE)).toBeCloseTo(300, 6);
  });

  it('A3 顶点顺序（顺/逆时针、反向）不影响面积', () => {
    const cw = [...L_SHAPE];
    const ccw = [...L_SHAPE].reverse();
    expect(polyAreaM2(ccw)).toBeCloseTo(polyAreaM2(cw), 6);
  });
});

describe('同一面积贯通标注/人数/出口判定', () => {
  it('A4 L 形房间人数按实际 300㎡ 估算（办公 10㎡/人 → 30 人，而非 bbox 的 40 人）', () => {
    const room = mkRoom('L室', 'office', L_SHAPE); // occupants 留空 → 按面积估算
    expect(room.areaM2).toBeCloseTo(300, 6);
    const { floor, rules } = mkFloor([room], [{ kind: 'exit', x: 5, y: 5 }]);
    const result = validateFloor(floor, rules);
    expect(result.exits.present).toBe(1);
    // 实际面积 300㎡ > 200㎡ 阈值 → 需 2 个出口；旧 bbox 算法下同样超阈但人数会虚高
    expect(result.exits.required).toBe(2);
    const exitItem = result.items.find((i) => i.type === 'EXIT_COUNT');
    expect(exitItem?.message).toContain('300㎡');
    expect(exitItem?.message).toContain('人数约 30 ');
  });

  it('A5 L 形房间面积虽未超 200㎡ 阈值时不把 bbox 面积误算进楼层总面积', () => {
    // 15×15 方框挖掉 10×10 → 实际 125㎡（bbox 225㎡，旧算法会误判 >200 需 2 出口）
    const smallL: Pt[] = [
      pt(0, 0), pt(15, 0), pt(15, 5), pt(5, 5), pt(5, 15), pt(0, 15),
    ];
    expect(polyAreaM2(smallL)).toBeCloseTo(125, 6);
    const room = mkRoom('小L室', 'other', smallL); // other: 20㎡/人 → 6 人
    const { floor } = mkFloor([room], [{ kind: 'exit', x: 2.5, y: 2.5 }]);
    const result = validateFloor(floor, DEFAULT_RULES.office);
    expect(result.exits.required).toBe(1); // 125㎡ / 6 人，均不超阈
    expect(result.items.some((i) => i.type === 'EXIT_COUNT')).toBe(false);
  });
});
