export type TourSide = "top" | "right" | "bottom" | "left";
export type TourAlign = "start" | "center" | "end";

export interface TourStep {
  id: string;

  element?: string;

  title: string;

  description: string;

  side?: TourSide;

  align?: TourAlign;

  onBeforeShow?: () => void | Promise<void>;

  onAfterShow?: () => void | Promise<void>;

  onHide?: () => void | Promise<void>;
}
