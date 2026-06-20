export interface HistoryAction<T = any> {
  type: string;
  targetId?: string;
  before: T;
  after: T;
  label?: string;
}

export interface HistoryGroupAction<T = any> {
  type: 'group';
  targetId?: string;
  before: HistoryAction<T>[];
  after: HistoryAction<T>[];
  label?: string;
}

export type AnyHistoryAction<T = any> = HistoryAction<T> | HistoryGroupAction<T>;

export class HistoryStack<T = any> {
  private undoStack: AnyHistoryAction<T>[] = [];
  private redoStack: AnyHistoryAction<T>[] = [];
  private maxSize = 100;
  private groupActions: HistoryAction<T>[] = [];
  private isGrouping = false;

  constructor(maxSize = 100) { this.maxSize = maxSize; }

  push(action: HistoryAction<T>) {
    if (this.isGrouping) {
      this.groupActions.push(action);
      return;
    }
    this.undoStack.push(action);
    if (this.undoStack.length > this.maxSize) this.undoStack.shift();
    this.redoStack = [];
  }

  beginGroup() {
    this.isGrouping = true;
    this.groupActions = [];
  }

  endGroup(label?: string) {
    this.isGrouping = false;
    if (this.groupActions.length === 0) return;
    const combined: HistoryGroupAction<T> = {
      type: 'group',
      before: [...this.groupActions],
      after: [...this.groupActions],
      label
    };
    this.undoStack.push(combined);
    if (this.undoStack.length > this.maxSize) this.undoStack.shift();
    this.redoStack = [];
    this.groupActions = [];
  }

  canUndo(): boolean { return this.undoStack.length > 0; }
  canRedo(): boolean { return this.redoStack.length > 0; }

  popUndo(): AnyHistoryAction<T> | null {
    const a = this.undoStack.pop() || null;
    if (a) this.redoStack.push(a);
    return a;
  }

  popRedo(): AnyHistoryAction<T> | null {
    const a = this.redoStack.pop() || null;
    if (a) this.undoStack.push(a);
    return a;
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this.groupActions = [];
    this.isGrouping = false;
  }

  get undoCount(): number { return this.undoStack.length; }
  get redoCount(): number { return this.redoStack.length; }
}
