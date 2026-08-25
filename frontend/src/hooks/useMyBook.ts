"use client";

import { useMemo } from "react";
import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { fetchMemory, fetchServices, type MemoryListing, type ServiceListing } from "@/lib/catalog";
import { isDone, isInProgress, memoryForSale, serviceNeedsYou, type NeedKind } from "@/lib/jobUi";

function mergeJobs(...lists: ServiceListing[][]): ServiceListing[] {
  const byId = new Map<number, ServiceListing>();
  for (const list of lists) {
    for (const job of list) byId.set(job.id, job);
  }
  return [...byId.values()].sort((a, b) => (b.listedAt || 0) - (a.listedAt || 0));
}

export function useMyBook() {
  const { address, isConnected } = useAccount();
  const enabled = Boolean(address);

  const listedJobs = useQuery({
    queryKey: ["me", "jobs-listed", address],
    queryFn: () => fetchServices({ seller: address, limit: 200 }),
    enabled,
    refetchInterval: 12_000,
  });
  const hiredJobs = useQuery({
    queryKey: ["me", "jobs-hired", address],
    queryFn: () => fetchServices({ buyer: address, limit: 200 }),
    enabled,
    refetchInterval: 12_000,
  });
  const listedMemory = useQuery({
    queryKey: ["me", "memory-listed", address],
    queryFn: () => fetchMemory({ seller: address, limit: 200 }),
    enabled,
    refetchInterval: 12_000,
  });
  const boughtMemory = useQuery({
    queryKey: ["me", "memory-bought", address],
    queryFn: () => fetchMemory({ buyer: address, limit: 200 }),
    enabled,
    refetchInterval: 12_000,
  });

  const jobs = useMemo(
    () => mergeJobs(listedJobs.data?.listings ?? [], hiredJobs.data?.listings ?? []),
    [listedJobs.data, hiredJobs.data],
  );

  const needs = useMemo(() => {
    return jobs
      .map((job) => ({ job, need: serviceNeedsYou(job, address) }))
      .filter((row): row is { job: ServiceListing; need: NeedKind } => row.need != null);
  }, [jobs, address]);

  const inProgress = useMemo(() => {
    const needIds = new Set(needs.map((row) => row.job.id));
    return jobs.filter((job) => isInProgress(job) && !needIds.has(job.id));
  }, [jobs, needs]);

  const done = useMemo(() => jobs.filter(isDone), [jobs]);

  const memoryOpen = useMemo(
    () => (listedMemory.data?.modules ?? []).filter((item) => memoryForSale(item, address)),
    [listedMemory.data, address],
  );

  const memoryOwned = useMemo(() => {
    const bought = boughtMemory.data?.modules ?? [];
    const soldByMe = (listedMemory.data?.modules ?? []).filter((item) => item.sold);
    const byId = new Map<number, MemoryListing>();
    for (const item of [...bought, ...soldByMe]) byId.set(item.id, item);
    return [...byId.values()];
  }, [boughtMemory.data, listedMemory.data]);

  return {
    address,
    isConnected,
    listedJobs,
    hiredJobs,
    listedMemory,
    boughtMemory,
    jobs,
    needs,
    inProgress,
    done,
    memoryOpen,
    memoryOwned,
    needsCount: needs.length,
    error: listedJobs.error || hiredJobs.error || listedMemory.error || boughtMemory.error,
    refetchAll() {
      listedJobs.refetch();
      hiredJobs.refetch();
      listedMemory.refetch();
      boughtMemory.refetch();
    },
  };
}

export function useInboxCount() {
  const book = useMyBook();
  if (!book.isConnected) return 0;
  return book.needsCount;
}
