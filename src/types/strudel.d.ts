declare module '@strudel/web' {
  export function initStrudel(): Promise<void>;
  export function evaluate(code: string): Promise<any>;
  export function hush(): void;
}

interface Window {
  evaluate?: (code: string) => Promise<any>;
  hush?: () => void;
  getAudioContext?: () => AudioContext;
}
