/**
 * Tipos Deno para scripts locais (`deno run scripts/...`).
 * Não usar em Edge Functions — lá o runtime já expõe tipos via edge-runtime.
 *
 * Libs abaixo expõem `console`, `URL`, etc. para o language service quando o script
 * referencia este arquivo via `/// <reference path="./deno-cli.d.ts" />`.
 */
/// <reference lib="es2022" />
/// <reference lib="dom" />

declare namespace Deno {
  const args: string[];
  function exit(code?: number): never;
  function cwd(): string;
  function readTextFile(path: string | URL): Promise<string>;
  function mkdir(path: string | URL, options?: { recursive?: boolean }): Promise<void>;
  function writeFile(path: string | URL, data: Uint8Array): Promise<void>;
}
