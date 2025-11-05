import { TourStep } from "./tour-step"

export abstract class TourGuide {
  private readonly steps: Array<TourStep>;

  constructor(steps: Array<TourStep> = []) {
    this.steps = steps;
  }

  addStep(step: TourStep): TourGuide {
    this.steps.push(step);

    return this;
  }

  abstract startTour(): void;
}
