import { TourStep } from "./tour-step";

/**
 * Configuration options for the TourGuide.
 */
export interface TourGuideOptions {
  /**
   * Whether to show a progress indicator (e.g. "1 of 5").
   */
  showProgress?: boolean;
  /**
   * Whether to allow the user to skip the tour.
   */
  allowSkip?: boolean;
  /**
   * Whether to enable keyboard navigation (arrows, esc).
   */
  keyboardNavigation?: boolean;
  /**
   * Opacity of the background overlay (0 to 1).
   */
  overlayOpacity?: number;
  /**
   * Label for the "Next" button.
   */
  nextLabel?: string;
  /**
   * Label for the "Previous" button.
   */
  prevLabel?: string;
  /**
   * Label for the "Finish" button.
   */
  finishLabel?: string;
  /**
   * Label for the "Skip" button.
   */
  skipLabel?: string;
}

/**
 * Interface for controlling a product tour.
 */
export interface TourGuide {
  /**
   * Current list of steps in the tour.
   */
  readonly steps: TourStep[];
  /**
   * Index of the currently active step.
   */
  readonly currentStepIndex: number;
  /**
   * Whether a tour is currently active.
   */
  readonly isActive: boolean;

  /**
   * Sets the complete list of steps for the tour.
   */
  setSteps(steps: TourStep[]): void;

  /**
   * Appends a step to the existing list.
   */
  addStep(step: TourStep): void;

  /**
   * Starts the tour from the first step.
   */
  start(): Promise<void>;

  /**
   * Moves to the next step.
   */
  next(): Promise<void>;

  /**
   * Moves to the previous step.
   */
  previous(): Promise<void>;

  /**
   * Terminates the tour immediately.
   */
  exit(): void;

  /**
   * Event listener for when the tour starts.
   */
  onStart(callback: () => void): void;

  /**
   * Event listener for when the tour ends (finished or skipped).
   */
  onEnd(callback: () => void): void;

  /**
   * Event listener for when the step changes.
   */
  onStepChange(callback: (step: TourStep, index: number) => void): void;
}
