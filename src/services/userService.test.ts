import { beforeEach, describe, expect, it } from 'vitest';
import {
  awardXP,
  levelFor,
  POMODORO_XP,
  progressFor,
  readProfile,
  TASK_XP,
  titleFor,
  XP_PER_LEVEL,
} from './userService';

const STORAGE_KEY = 'student-tasks:user';

describe('level math', () => {
  it('fills a level at exactly 100 XP', () => {
    expect(levelFor(0)).toBe(1);
    expect(levelFor(99)).toBe(1);
    expect(levelFor(100)).toBe(2);
    expect(levelFor(199)).toBe(2);
    expect(levelFor(200)).toBe(3);
  });

  it('reports progress into the current level', () => {
    expect(progressFor(0)).toBe(0);
    expect(progressFor(45)).toBe(45);
    expect(progressFor(99)).toBe(99);
    expect(progressFor(100)).toBe(0);
    expect(progressFor(145)).toBe(45);
  });

  it('assigns a title per level and caps past the last', () => {
    expect(titleFor(1)).toBe('Pemula');
    expect(titleFor(2)).toBe('Murid Tekun');
    expect(titleFor(8)).toBe('Legenda Kampus');
    expect(titleFor(99)).toBe('Legenda Kampus');
  });
});

describe('awardXP', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('awards task XP and persists the total', () => {
    const result = awardXP(TASK_XP);

    expect(result.xp).toBe(20);
    expect(result.level).toBe(1);
    expect(result.progress).toBe(20);
    expect(result.leveledUp).toBe(false);
    expect(readProfile()).toEqual({ xp: 20 });
  });

  it('flags a level-up at the boundary and keeps the title in step', () => {
    awardXP(90);
    const result = awardXP(POMODORO_XP);

    expect(result.xp).toBe(100);
    expect(result.level).toBe(2);
    expect(result.previousLevel).toBe(1);
    expect(result.leveledUp).toBe(true);
    expect(result.title).toBe('Murid Tekun');
    expect(result.progress).toBe(0);
  });

  it('ignores negative and non-finite amounts', () => {
    awardXP(30);
    const result = awardXP(-50);

    expect(result.xp).toBe(30);
    expect(awardXP(Number.NaN).xp).toBe(30);
  });

  it('starts from zero when no profile is stored', () => {
    expect(readProfile()).toEqual({ xp: 0 });
  });

  it('resets a corrupt profile instead of throwing', () => {
    window.localStorage.setItem(STORAGE_KEY, '{rusak');

    expect(readProfile()).toEqual({ xp: 0 });
    expect(awardXP(TASK_XP).xp).toBe(20);
  });

  it('keeps the constants the rewards are built on', () => {
    expect(XP_PER_LEVEL).toBe(100);
    expect(TASK_XP).toBe(20);
    expect(POMODORO_XP).toBe(10);
  });
});
