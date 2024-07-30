export type PointOrOrigin = Point | "origin";
export interface Point {
  hash: string;
  slot: number;
  height: number;
}
