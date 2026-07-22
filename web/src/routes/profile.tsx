import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Check,
  Edit3,
  Gamepad2,
  MessageCircle,
  ShieldCheck,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/GameCover";
import { Chip, SectionHeader } from "@/components/ui-bits";
import { getProfileSummary, updateProfile } from "@/lib/api";
import { lovableQueryKeys } from "@/lib/lovable-data";

export const Route = createFileRoute("/profile")({ component: ProfilePage });
const PLATFORM_OPTIONS = [
  "Steam",
  "PC",
  "PlayStation",
  "Xbox",
  "Nintendo Switch",
  "Mobile",
];
const GENRE_OPTIONS = [
  "Action",
  "Adventure",
  "RPG",
  "Roguelike",
  "Strategy",
  "Puzzle",
  "Shooter",
  "Simulation",
  "Sports",
  "Indie",
];
const toggle = (values: string[], value: string) =>
  values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];

export function ProfilePage() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: lovableQueryKeys.profileSummary,
    queryFn: getProfileSummary,
  });
  const s = query.data;
  const user = s?.account.data?.user;
  const profile = s?.profile.data;
  const stats = s?.library.data;
  const services = s?.services.data;
  const favorites = s?.favorites.data ?? [];
  const wishlist = s?.wishlist.data ?? [];
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState("");
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const save = useMutation({
    mutationFn: updateProfile,
    onSuccess: () => {
      setEditing(false);
      client.invalidateQueries({ queryKey: lovableQueryKeys.profileSummary });
    },
  });
  const open = () => {
    setBio(profile?.bio ?? "");
    setPlatforms(profile?.platforms ?? []);
    setGenres(profile?.favorite_genres ?? []);
    setEditing(true);
  };
  if (query.isError)
    return (
      <AppShell>
        <SectionHeader title="Profile" hint="Sign in to view your profile." />
        <Link to="/login">Sign in</Link>
      </AppShell>
    );
  const rows = [
    {
      n: "Steam",
      d: services?.steam.linked
        ? (services.steam.persona_name ?? "Steam library connected")
        : "Connect your library and playtime",
      i: Gamepad2,
      ok: services?.steam.linked,
      to: "/steam",
    },
    {
      n: "PlayStation export",
      d: `${stats?.psn_games ?? 0} imported games`,
      i: ShieldCheck,
      ok: Boolean(stats?.psn_games),
      to: "/psn",
    },
    {
      n: "Telegram",
      d: services?.telegram.linked
        ? "Price alerts connected"
        : "Price alerts are optional",
      i: MessageCircle,
      ok: services?.telegram.linked,
    },
    {
      n: "Google",
      d: services?.google.linked ? "Connected" : "Sign-in not connected",
      i: ShieldCheck,
      ok: services?.google.linked,
    },
  ];
  return (
    <AppShell>
      <section className="relative mb-10 overflow-hidden rounded-3xl border border-border">
        <div className="h-40 bg-gradient-to-br from-primary/45 via-primary/10 to-background" />
        <div className="flex flex-col items-start gap-4 px-6 pb-6 sm:flex-row sm:items-end">
          <Avatar
            from="#22c55e"
            to="#0f766e"
            name={user?.email ?? "Player"}
            className="-mt-12 size-24 rounded-2xl ring-4 ring-background"
          />
          <div className="flex-1">
            <h1 className="text-3xl font-extrabold">
              {user?.email ?? "Your profile"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {profile?.bio ||
                "Set a short bio and preferences to improve recommendations."}
            </p>
          </div>
          <button
            onClick={open}
            className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-bold"
          >
            <Edit3 className="size-3.5" />
            Edit profile
          </button>
        </div>
      </section>
      {editing && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate({ bio, platforms, favorite_genres: genres });
          }}
          className="mb-8 rounded-2xl border border-border bg-surface p-6"
        >
          <label>
            Bio
            <textarea
              aria-label="Bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="mt-2 w-full rounded border border-border bg-background p-2"
            />
          </label>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <fieldset>
              <legend className="text-sm font-bold">Platforms</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {PLATFORM_OPTIONS.map((value) => (
                  <button
                    type="button"
                    key={value}
                    onClick={() =>
                      setPlatforms((current) => toggle(current, value))
                    }
                    className={`rounded-md border px-3 py-1.5 text-xs font-bold ${platforms.includes(value) ? "border-primary bg-primary/15 text-primary" : "border-border"}`}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-sm font-bold">Favorite genres</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {GENRE_OPTIONS.map((value) => (
                  <button
                    type="button"
                    key={value}
                    onClick={() =>
                      setGenres((current) => toggle(current, value))
                    }
                    className={`rounded-md border px-3 py-1.5 text-xs font-bold ${genres.includes(value) ? "border-primary bg-primary/15 text-primary" : "border-border"}`}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
          <button className="mt-4 rounded bg-primary px-4 py-2 font-bold text-primary-foreground">
            Save profile
          </button>
        </form>
      )}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          ["Library", stats?.total_games],
          [
            "Hours played",
            stats?.total_playtime_hours === undefined
              ? undefined
              : `${stats.total_playtime_hours}h`,
          ],
          ["Manual games", stats?.manual_games],
          ["PSN games", stats?.psn_games],
        ].map(([l, v]) => (
          <div
            key={String(l)}
            className="rounded-2xl border border-border bg-surface p-5"
          >
            <p className="text-xs text-muted-foreground">{l}</p>
            <p className="text-3xl font-black">{v ?? "—"}</p>
          </div>
        ))}
      </div>
      <div className="mt-10 grid gap-8 lg:grid-cols-12">
        <section className="space-y-8 lg:col-span-8">
          <div>
            <SectionHeader title="Preferences" />
            <div className="rounded-2xl border border-border bg-surface p-6">
              <p className="text-xs text-muted-foreground">Favorite genres</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {profile?.favorite_genres?.length
                  ? profile.favorite_genres.map((x) => (
                      <Chip key={x} tone="primary">
                        {x}
                      </Chip>
                    ))
                  : "Not set yet"}
              </div>
              <p className="mt-5 text-xs text-muted-foreground">Platforms</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {profile?.platforms?.length
                  ? profile.platforms.map((x) => (
                      <Chip key={x} tone="outline">
                        {x}
                      </Chip>
                    ))
                  : "Not set yet"}
              </div>
            </div>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <SectionHeader title="Favorite games" />
              {favorites.length ? (
                favorites.map((g) => (
                  <p
                    key={g.id}
                    className="rounded-lg border border-border bg-surface p-3 font-bold"
                  >
                    {g.title}
                  </p>
                ))
              ) : (
                <p>No favorite games yet.</p>
              )}
            </div>
            <div>
              <SectionHeader title="Active wishlist" />
              {wishlist.length ? (
                wishlist.map((g) => <p key={g.id}>{g.title}</p>)
              ) : (
                <p>{s?.wishlist.message ?? "No wishlist games yet."}</p>
              )}
            </div>
          </div>
        </section>
        <aside className="rounded-2xl border border-border bg-surface p-6 lg:col-span-4">
          <SectionHeader title="Integrations" />
          {rows.map((r) => (
            <div
              key={r.n}
              className="flex items-center gap-3 border-t border-border py-4 first:border-t-0"
            >
              <r.i className="size-5 text-primary" />
              <div className="flex-1">
                <p className="font-bold">{r.n}</p>
                <p className="text-xs text-muted-foreground">{r.d}</p>
              </div>
              {r.ok ? (
                <Chip tone="primary">
                  <Check className="mr-1 size-3" />
                  Connected
                </Chip>
              ) : r.to ? (
                <Link
                  to={r.to}
                  className="rounded border border-border px-2 py-1 text-xs"
                >
                  Connect
                </Link>
              ) : (
                <span className="text-xs text-muted-foreground">
                  Not connected
                </span>
              )}
            </div>
          ))}
        </aside>
      </div>
    </AppShell>
  );
}
