/**
 * 当前登录账号的学习态 localStorage 读写（自动挂 getAppUserId）。
 */
import { getAppUserId } from './profileHelper';
import { getLearnItem, removeLearnItem, setLearnItem } from './accountStorage';

export function learnGet(logicalName: string): string | null {
  return getLearnItem(getAppUserId(), logicalName);
}

export function learnSet(logicalName: string, value: string): void {
  setLearnItem(getAppUserId(), logicalName, value);
}

export function learnRemove(logicalName: string): void {
  removeLearnItem(getAppUserId(), logicalName);
}
