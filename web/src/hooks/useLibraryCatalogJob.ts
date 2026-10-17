import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  dismissLibraryCatalogMatchingJob,
  cancelLibraryCatalogMatchingJob,
  getToken,
  getCurrentLibraryCatalogMatchingJob,
  startLibraryCatalogMatchingJob,
  type LibraryCatalogMatchingJob,
} from "@/lib/api";

export function useLibraryCatalogJob(source?: "psn" | "manual") {
  const client = useQueryClient();
  const queryKey = ["library-catalog-matching-job", source ?? "all"];
  const current = useQuery({
    queryKey,
    queryFn: () => getCurrentLibraryCatalogMatchingJob(source),
    retry: false,
    staleTime: 1000,
    refetchInterval: (query) =>
      ["queued", "running"].includes(query.state.data?.status ?? "") ? 1500 : false,
  });
  const cancel = useMutation({
    mutationFn: (jobId: string) => cancelLibraryCatalogMatchingJob(jobId),
    onMutate: async () => {
      const token = getToken();
      await client.cancelQueries({ queryKey });
      if (getToken() !== token) throw new Error("Sign-in changed. Please try again.");
      return token;
    },
    onSuccess: (cancelled, jobId, token) => {
      if (getToken() !== token) return;
      const currentJob = client.getQueryData<LibraryCatalogMatchingJob | null>(queryKey);
      if (currentJob?.id === jobId) client.setQueryData(queryKey, cancelled);
    },
  });
  const start = useMutation({
    mutationFn: (includeLinked: boolean) =>
      source
        ? startLibraryCatalogMatchingJob(includeLinked, source)
        : startLibraryCatalogMatchingJob(includeLinked),
    onMutate: async () => {
      const token = getToken();
      await client.cancelQueries({ queryKey });
      if (getToken() !== token) throw new Error("Sign-in changed. Please try again.");
      return token;
    },
    onSuccess: (job, _includeLinked, token) => {
      if (getToken() === token) client.setQueryData(queryKey, job);
    },
  });
  async function dismiss(jobId: string) {
    const job = client.getQueryData<LibraryCatalogMatchingJob | null>(queryKey);
    if (job?.id === jobId) {
      await client.cancelQueries({ queryKey });
      client.setQueryData(queryKey, null);
    }
    await dismissLibraryCatalogMatchingJob(jobId);
  }
  const job = current.data;
  const running = start.isPending || job?.status === "queued" || job?.status === "running";
  return { current, start, cancel, job, running, dismiss };
}
