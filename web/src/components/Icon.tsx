import type { ComponentPropsWithoutRef, ReactNode } from "react";

export type IconName =
  | "arrow-left"
  | "arrow-right"
  | "bell"
  | "check"
  | "chevron-down"
  | "external-link"
  | "gamepad"
  | "heart"
  | "log-in"
  | "log-out"
  | "search"
  | "sparkles"
  | "tag"
  | "trash"
  | "user"
  | "user-plus"
  | "x";

type IconProps = Omit<ComponentPropsWithoutRef<"svg">, "children"> & {
  name: IconName;
  title?: string;
};

const paths: Record<IconName, ReactNode> = {
  "arrow-left": <path d="m15 18-6-6 6-6M9 12h12" />,
  "arrow-right": <path d="m9 18 6-6-6-6m6 6H3" />,
  bell: <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-7.73 13h3.46" />,
  check: <path d="m5 12 4 4L19 6" />,
  "chevron-down": <path d="m6 9 6 6 6-6" />,
  "external-link": <path d="M15 3h6v6m-11 5L21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />,
  gamepad: <path d="M6 11h4m-2-2v4m5.5-1h.01M17 10h.01M7 18h10c2.5 0 3.2-1.7 2.7-3.7l-1.1-4.5A3 3 0 0 0 15.7 7H8.3a3 3 0 0 0-2.9 2.8l-1.1 4.5C3.8 16.3 4.5 18 7 18Z" />,
  heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.9-8.6a5.5 5.5 0 0 0-.1-7.8Z" />,
  "log-in": <path d="M10 17l5-5-5-5m5 5H3m10-8h5a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3h-5" />,
  "log-out": <path d="m14 17 5-5-5-5m5 5H7m3-8H6a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h4" />,
  search: <path d="m21 21-4.35-4.35M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" />,
  sparkles: <path d="m12 3-1.5 5.5L5 10l5.5 1.5L12 17l1.5-5.5L19 10l-5.5-1.5L12 3ZM5 17l-.7 2.3L2 20l2.3.7L5 23l.7-2.3L8 20l-2.3-.7L5 17Zm14-1-.7 2.3L16 19l2.3.7L19 22l.7-2.3L22 19l-2.3-.7L19 16Z" />,
  tag: <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8ZM7.5 7.5h.01" />,
  trash: <path d="M4 7h16m-10 4v6m4-6v6M9 7l1-3h4l1 3m-9 0 1 14h10l1-14" />,
  user: <path d="M20 21a8 8 0 0 0-16 0m12-11a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" />,
  "user-plus": <path d="M16 21a6 6 0 0 0-12 0m9-11a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6-2v6m3-3h-6" />,
  x: <path d="m6 6 12 12M18 6 6 18" />,
};

export function Icon({ name, title, ...props }: IconProps) {
  const accessibleName = title ?? props["aria-label"];

  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={accessibleName ? undefined : true}
      role={accessibleName ? "img" : undefined}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {paths[name]}
    </svg>
  );
}
