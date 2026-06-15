declare module "ffjavascript" {
  export class Scalar {
    static fromString(s: string): unknown;
  }
  export class F1Field {
    constructor(r: unknown);
    e(n: bigint | string | number): unknown;
    toString(v: unknown): string;
    toObject(v: unknown): string | number | bigint;
    add(a: unknown, b: unknown): unknown;
    mul(a: unknown, b: unknown): unknown;
  }
}
