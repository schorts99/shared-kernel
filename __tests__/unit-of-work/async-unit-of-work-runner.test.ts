import {
  AsyncUnitOfWorkRunner,
  CommitOutcomeUnknownError,
  InMemoryUnitOfWork,
} from "../../src";
import type {
  UnitOfWork,
} from "../../src";

describe("AsyncUnitOfWorkRunner", () => {
  it("runs the commit outcome reconciliation hook", async () => {
    class ReconcilingRunner extends AsyncUnitOfWorkRunner {
      constructor(private readonly resolution: "committed" | "not-committed" | "unknown") {
        super();
      }

      protected createUnitOfWork(): UnitOfWork {
        const uow = new InMemoryUnitOfWork();
        uow.commit = async () => {
          throw new Error("ambiguous network drop");
        };
        return uow;
      }

      protected override async resolveCommitOutcome(): Promise<"committed" | "not-committed" | "unknown"> {
        return this.resolution;
      }
    }

    await expect(new ReconcilingRunner("committed").run(async () => "ok")).resolves.toBe("ok");
    await expect(new ReconcilingRunner("not-committed").run(async () => "ok")).rejects.toThrow("ambiguous network drop");
    await expect(new ReconcilingRunner("unknown").run(async () => "ok")).rejects.toThrow(CommitOutcomeUnknownError);
  });
});
