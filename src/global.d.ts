export {};

declare global {
  interface Window {
    __cmUndo: () => boolean;
    __cmRedo: () => boolean;
  }
}
