import { TourStep } from "./tour-step";
export declare abstract class TourGuide {
    private readonly steps;
    constructor(steps?: Array<TourStep>);
    addStep(step: TourStep): TourGuide;
    abstract startTour(): void;
}
//# sourceMappingURL=tour-guide.d.ts.map