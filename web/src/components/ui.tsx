"use client";

import { CircleAlert, Inbox, LoaderCircle, LogIn } from "lucide-react";
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { useId } from "react";
import styles from "./ui.module.css";

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(" ");
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "quiet";
};

export function Button({ className, type = "button", variant = "primary", ...props }: ButtonProps) {
  return <button className={joinClassNames(styles.button, styles[variant], className)} type={type} {...props} />;
}

export type PanelProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  as?: "article" | "div" | "section";
};

export function Panel({ as: Element = "section", className, children, ...props }: PanelProps) {
  return <Element className={joinClassNames(styles.panel, className)} {...props}>{children}</Element>;
}

export type StatePanelProps = {
  kind: "loading" | "error" | "empty" | "unauthenticated";
  title: string;
  detail?: string;
  action?: { label: string; onClick: () => void };
};

const stateIcons = {
  loading: LoaderCircle,
  error: CircleAlert,
  empty: Inbox,
  unauthenticated: LogIn,
};

export function StatePanel({ kind, title, detail, action }: StatePanelProps) {
  const Icon = stateIcons[kind];

  return (
    <Panel className={styles.statePanel} data-state={kind}>
      <Icon aria-hidden="true" className={kind === "loading" ? styles.loadingIcon : undefined} />
      <div>
        <h2>{title}</h2>
        {detail ? <p>{detail}</p> : null}
      </div>
      {action ? <Button onClick={action.onClick}>{action.label}</Button> : null}
    </Panel>
  );
}

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode;
  tone?: "default" | "accent" | "success";
};

export function Badge({ children, className, tone = "default", ...props }: BadgeProps) {
  return <span className={joinClassNames(styles.badge, styles[`badge${tone}`], className)} {...props}>{children}</span>;
}

export type SectionProps = HTMLAttributes<HTMLElement> & {
  title: string;
  detail?: string;
  action?: ReactNode;
  children: ReactNode;
};

export function Section({ title, detail, action, children, className, ...props }: SectionProps) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className={joinClassNames(styles.section, className)} {...props}>
      <header className={styles.sectionHeader}>
        <div>
          <h2 id={headingId}>{title}</h2>
          {detail ? <p>{detail}</p> : null}
        </div>
        {action ? <div className={styles.sectionAction}>{action}</div> : null}
      </header>
      {children}
    </section>
  );
}
