import { TrackedError } from "./tracked-error.js";

export interface ErrorUploader {
  upload(errors: Array<TrackedError>): Promise<void>;
}
