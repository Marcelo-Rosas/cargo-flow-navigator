/** Ambient declarations for Deno runtime when IDE doesn't load edge-runtime types */
declare namespace Deno {
  const env: {
    get(key: string): string | undefined;
    toObject(): Record<string, string>;
  };
  function serve(
    handler: (req: Request) => Response | Promise<Response>,
    options?: { port?: number; hostname?: string }
  ): void;
}
