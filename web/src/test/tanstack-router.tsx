import type { AnchorHTMLAttributes, ReactNode } from "react";

export function Link({
  to,
  children,
  params: _params,
  search: _search,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  to: string;
  children: ReactNode;
  params?: unknown;
  search?: unknown;
}) {
  return (
    <a href={to} {...props}>
      {children}
    </a>
  );
}

export function useNavigate() {
  return () => Promise.resolve();
}

export function useRouterState<T>({
  select,
}: {
  select: (state: { location: { pathname: string } }) => T;
}) {
  return select({ location: { pathname: "/" } });
}
