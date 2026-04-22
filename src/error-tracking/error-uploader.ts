import { TrackedError } from "./tracked-error";

export interface ErrorUploader {
  upload(errors: Array<TrackedError>): Promise<void>;
}
