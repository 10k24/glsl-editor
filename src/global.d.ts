export {};

declare global {
  interface Window {
    __cmUndo: () => boolean;
    __cmRedo: () => boolean;
    __cmSetCursor: (pos: number) => void;
    __cmGetDoc: () => string;
  }
}
