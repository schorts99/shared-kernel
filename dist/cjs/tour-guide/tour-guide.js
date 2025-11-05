"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TourGuide = void 0;
class TourGuide {
    steps;
    constructor(steps = []) {
        this.steps = steps;
    }
    addStep(step) {
        this.steps.push(step);
        return this;
    }
}
exports.TourGuide = TourGuide;
//# sourceMappingURL=tour-guide.js.map