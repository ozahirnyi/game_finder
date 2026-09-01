"use client";

import { Link } from "@tanstack/react-router";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import { GameCover } from "@/components/GameCover";
import { StatePanel } from "@/components/ui";
import { Chip } from "@/components/ui-bits";
import {
  ApiError,
  getAuthSnapshot,
  getRecommendationQuota,
  getRecommendations,
  subscribeToAuthChanges,
  type RecommendationItem,
  type RecommendationQuota,
} from "@/lib/api";

function isRecommendationQuota(value: unknown): value is RecommendationQuota {
  if (!value || typeof value !== "object") return false;
  const quota = value as Record<string, unknown>;
  return (
    typeof quota.limit === "number" &&
    typeof quota.remaining === "number" &&
    (typeof quota.cooldown_until === "string" ||
      quota.cooldown_until === null) &&
    typeof quota.reset_at === "string"
  );
}

function isQuotaDetail(
  value: unknown,
): value is { quota: RecommendationQuota } {
  if (!value || typeof value !== "object") return false;
  return isRecommendationQuota((value as Record<string, unknown>).quota);
}

function RecommendationCard({ item }: { item: RecommendationItem }) {
  const title = item.game?.name ?? item.title;
  const content = (
    <>
      <GameCover
        title={title}
        src={item.game?.background_image}
        className="aspect-[3/4] w-full"
      />
      <div className="p-4">
        <span className="font-mono text-[10px] uppercase tracking-widest text-primary">
          AI pick
        </span>
        <h3 className="mt-2 font-bold">{title}</h3>
        {item.game?.released ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {item.game.released}
          </p>
        ) : null}
        {item.game?.platforms.length ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {item.game.platforms.join(" · ")}
          </p>
        ) : null}
        <p className="mt-3 text-sm text-muted-foreground">{item.reason}</p>
        <div className="mt-3 flex flex-wrap gap-1">
          {item.tags.map((tag) => (
            <Chip key={tag}>{tag}</Chip>
          ))}
        </div>
      </div>
    </>
  );

  if (item.game) {
    return (
      <Link
        to="/games/$gameId"
        params={{ gameId: String(item.game.id) }}
        aria-label={`View ${item.game.name}`}
        className="overflow-hidden rounded-xl border border-border bg-surface transition hover:border-white/20"
      >
        {content}
      </Link>
    );
  }

  return (
    <article className="overflow-hidden rounded-xl border border-border bg-surface">
      {content}
      <a
        className="m-4 inline-flex text-sm font-bold text-primary"
        href={`/search?q=${encodeURIComponent(item.title)}`}
      >
        Search catalog for {item.title}
      </a>
    </article>
  );
}

export function AiRecommendationSearch() {
  const authenticated = useSyncExternalStore(
    subscribeToAuthChanges,
    getAuthSnapshot,
    () => false,
  );
  const [quota, setQuota] = useState<RecommendationQuota | null>(null);
  const [quotaState, setQuotaState] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>(
    [],
  );
  const [prompt, setPrompt] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const authGenerationRef = useRef(0);

  const loadQuotaForGeneration = useCallback(async (generation: number) => {
    setQuotaState("loading");
    try {
      const nextQuota = await getRecommendationQuota();
      if (generation !== authGenerationRef.current) return;
      setQuota(nextQuota);
      setNow(Date.now());
      setQuotaState("success");
    } catch {
      if (generation !== authGenerationRef.current) return;
      setQuota(null);
      setQuotaState("error");
    }
  }, []);

  const loadQuota = useCallback(() => {
    void loadQuotaForGeneration(authGenerationRef.current);
  }, [loadQuotaForGeneration]);

  useEffect(() => {
    const generation = authGenerationRef.current + 1;
    authGenerationRef.current = generation;
    setQuota(null);
    setQuotaState(authenticated ? "loading" : "idle");
    setRecommendations([]);
    setPrompt("");
    setPending(false);
    setError("");
    setNow(Date.now());
    if (authenticated) {
      void loadQuotaForGeneration(generation);
    }
    return () => {
      if (authGenerationRef.current === generation) {
        authGenerationRef.current += 1;
      }
    };
  }, [authenticated, loadQuotaForGeneration]);

  const cooldownSeconds = quota?.cooldown_until
    ? Math.max(0, Math.ceil((Date.parse(quota.cooldown_until) - now) / 1000))
    : 0;

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [cooldownSeconds]);

  const disabled =
    pending ||
    quotaState !== "success" ||
    !quota ||
    quota.remaining === 0 ||
    cooldownSeconds > 0;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const normalized = prompt.trim();
    if (!normalized || disabled) return;
    const generation = authGenerationRef.current;
    setPending(true);
    setError("");
    try {
      const response = await getRecommendations(normalized);
      if (generation !== authGenerationRef.current) return;
      setRecommendations(response.recommendations);
      setQuota(response.quota);
      setNow(Date.now());
    } catch (reason) {
      if (generation !== authGenerationRef.current) return;
      if (
        reason instanceof ApiError &&
        reason.status === 429 &&
        isQuotaDetail(reason.detail)
      ) {
        setQuota(reason.detail.quota);
        setNow(Date.now());
      }
      setError(
        reason instanceof Error ? reason.message : "AI search is unavailable.",
      );
    } finally {
      if (generation === authGenerationRef.current) {
        setPending(false);
      }
    }
  }

  if (!authenticated) {
    return (
      <section className="mb-10 rounded-2xl border border-primary/20 bg-primary/5 p-6">
        <p className="font-mono text-xs uppercase tracking-widest text-primary">
          AI game search
        </p>
        <h2 className="mt-2 text-2xl font-bold">
          Personalized picks require an account
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in to get up to three AI searches per UTC day.
        </p>
        <Link
          to="/login"
          className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 font-bold text-primary-foreground"
        >
          Sign in
        </Link>
      </section>
    );
  }

  return (
    <section className="mb-10 rounded-2xl border border-border bg-surface p-6">
      <p className="font-mono text-xs uppercase tracking-widest text-primary">
        AI game search
      </p>
      <h2 className="mt-2 text-2xl font-bold">
        Describe what you want to play
      </h2>
      {quota ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {quota.remaining} of {quota.limit} AI searches remaining today
        </p>
      ) : null}
      {quotaState === "loading" ? (
        <StatePanel kind="loading" title="Loading AI search allowance" />
      ) : null}
      {quotaState === "error" ? (
        <StatePanel
          kind="error"
          title="AI search allowance is unavailable"
          action={{ label: "Retry", onClick: loadQuota }}
        />
      ) : null}
      {error ? (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <form onSubmit={submit} className="mt-5 flex gap-3">
        <label className="sr-only" htmlFor="ai-search-prompt">
          Describe what you want to play
        </label>
        <input
          id="ai-search-prompt"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          className="flex-1 rounded-xl border border-border bg-background px-4 py-3"
        />
        <button
          type="submit"
          disabled={disabled}
          className="rounded-xl bg-primary px-5 font-bold text-primary-foreground disabled:opacity-50"
        >
          {pending
            ? "Finding games…"
            : cooldownSeconds > 0
              ? `Try again in ${cooldownSeconds}s`
              : quota?.remaining === 0
                ? `Resets ${new Date(quota.reset_at).toLocaleString()}`
                : "Find games"}
        </button>
      </form>
      {pending ? (
        <div
          aria-label="Loading recommendations"
          className="mt-6 grid grid-cols-2 gap-5 lg:grid-cols-4"
        >
          {[0, 1, 2, 3].map((key) => (
            <div
              key={key}
              className="aspect-[3/4] animate-pulse rounded-xl bg-surface-2"
            />
          ))}
        </div>
      ) : null}
      {!pending && recommendations.length ? (
        <div className="mt-6 grid grid-cols-2 gap-5 lg:grid-cols-4">
          {recommendations.map((item) => (
            <RecommendationCard
              key={`${item.title}-${item.reason}`}
              item={item}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
