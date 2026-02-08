declare module "canvas-confetti" {
  type Options = Record<string, unknown>;
  type Create = (
    canvas?: HTMLCanvasElement,
    options?: Options,
  ) => (opts?: Options) => void;

  interface ConfettiFn {
    (options?: Options): Promise<null> | null;
    create: Create;
    reset: () => void;
  }

  const confetti: ConfettiFn;
  export default confetti;
}
