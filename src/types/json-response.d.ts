// TypeScript 5.9 + los tipos de fetch de Node marcan Response.json() como unknown.
// El resto de la app lo trata como JSON libre. Esto devuelve el comportamiento anterior
// para que el typecheck del proyecto vuelva a pasar.
export {};

declare global {
  interface Body {
    json(): Promise<any>;
  }
}
