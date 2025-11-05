import { TourStep } from "./tour-step"

export interface TourGuide {
  addStep(step: TourStep): TourGuide;
  startTour(): void;
}
