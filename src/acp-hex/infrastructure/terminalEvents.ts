/**
 * Terminal event bus — routes terminal/data and terminal/exit
 * notifications from the ACP service to the TerminalPanel component.
 */

type TerminalDataListener = (id: string, data: string) => void;
type TerminalExitListener = (id: string, code: number) => void;

class TerminalEventBus {
  private dataListeners = new Map<string, Set<TerminalDataListener>>();
  private exitListeners = new Map<string, Set<TerminalExitListener>>();

  onData(terminalId: string, cb: TerminalDataListener): () => void {
    if (!this.dataListeners.has(terminalId)) {
      this.dataListeners.set(terminalId, new Set());
    }
    this.dataListeners.get(terminalId)!.add(cb);
    return () => this.dataListeners.get(terminalId)?.delete(cb);
  }

  onExit(terminalId: string, cb: TerminalExitListener): () => void {
    if (!this.exitListeners.has(terminalId)) {
      this.exitListeners.set(terminalId, new Set());
    }
    this.exitListeners.get(terminalId)!.add(cb);
    return () => this.exitListeners.get(terminalId)?.delete(cb);
  }

  emitData(id: string, data: string): void {
    this.dataListeners.get(id)?.forEach((cb) => cb(id, data));
  }

  emitExit(id: string, code: number): void {
    this.exitListeners.get(id)?.forEach((cb) => cb(id, code));
  }

  cleanup(terminalId: string): void {
    this.dataListeners.delete(terminalId);
    this.exitListeners.delete(terminalId);
  }
}

export const terminalEvents = new TerminalEventBus();
