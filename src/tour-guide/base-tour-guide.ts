import { TourGuide, TourGuideOptions } from "./tour-guide";
import { TourStep } from "./tour-step";

export abstract class BaseTourGuide implements TourGuide {
  private _steps: TourStep[] = [];
  private _currentIndex = -1;
  private _isActive = false;

  private startListeners: (() => void)[] = [];
  private endListeners: (() => void)[] = [];
  private changeListeners: ((step: TourStep, index: number) => void)[] = [];

  constructor(protected readonly options: TourGuideOptions = {}) { }

  get steps(): TourStep[] {
    return [...this._steps];
  }

  get currentStepIndex(): number {
    return this._currentIndex;
  }

  get isActive(): boolean {
    return this._isActive;
  }

  setSteps(steps: TourStep[]): void {
    this._steps = [...steps];
  }

  addStep(step: TourStep): void {
    this._steps.push(step);
  }

  async start(): Promise<void> {
    if (this._steps.length === 0) return;

    this._isActive = true;
    this._currentIndex = 0;

    this.startListeners.forEach((l) => l());
    await this.showStep(this._currentIndex);
  }

  async next(): Promise<void> {
    if (!this._isActive) return;

    if (this._currentIndex < this._steps.length - 1) {
      await this.hideStep(this._currentIndex);
      this._currentIndex++;
      await this.showStep(this._currentIndex);
    } else {
      this.exit();
    }
  }

  async previous(): Promise<void> {
    if (!this._isActive || this._currentIndex <= 0) return;

    await this.hideStep(this._currentIndex);
    this._currentIndex--;
    await this.showStep(this._currentIndex);
  }

  exit(): void {
    if (!this._isActive) return;

    this._isActive = false;
    this._currentIndex = -1;

    this.endListeners.forEach((l) => l());
  }

  onStart(callback: () => void): void {
    this.startListeners.push(callback);
  }

  onEnd(callback: () => void): void {
    this.endListeners.push(callback);
  }

  onStepChange(callback: (step: TourStep, index: number) => void): void {
    this.changeListeners.push(callback);
  }

  protected async showStep(index: number): Promise<void> {
    const step = this._steps[index];

    if (!step) return;

    if (step.onBeforeShow) await step.onBeforeShow();

    this.changeListeners.forEach((l) => l(step, index));
    this.renderStep(step);

    if (step.onAfterShow) await step.onAfterShow();
  }

  protected async hideStep(index: number): Promise<void> {
    const step = this._steps[index];

    if (step?.onHide) await step.onHide();
  }

  protected abstract renderStep(step: TourStep): void;
}
