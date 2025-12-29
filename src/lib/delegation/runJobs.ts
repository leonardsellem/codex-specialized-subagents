export type RunJobsJobResult<TResult> =
  | { status: "completed"; value: TResult }
  | { status: "failed"; error: string }
  | { status: "skipped" };

export type RunJobsResult<TResult> = {
  cancelled: boolean;
  results: RunJobsJobResult<TResult>[];
};

export async function runJobs<TJob, TResult>(
  jobs: TJob[],
  options: {
    maxParallel: number;
    signal?: AbortSignal;
    runJob: (job: TJob, options: { signal?: AbortSignal }) => Promise<TResult>;
  },
): Promise<RunJobsResult<TResult>> {
  const maxParallel = Math.max(1, options.maxParallel);
  const signal = options.signal;
  const results: RunJobsJobResult<TResult>[] = jobs.map(() => ({ status: "skipped" }));

  let nextIndex = 0;

  const worker = async (): Promise<void> => {
    while (true) {
      if (signal?.aborted) return;

      const index = nextIndex;
      nextIndex++;
      if (index >= jobs.length) return;

      const job = jobs[index];
      if (signal?.aborted) return;

      try {
        const value = await options.runJob(job, { signal });
        results[index] = { status: "completed", value };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        results[index] = { status: "failed", error: message };
      }
    }
  };

  const workers = Array.from({ length: Math.min(maxParallel, jobs.length) }, () => worker());
  await Promise.all(workers);

  return { cancelled: signal?.aborted ?? false, results };
}

