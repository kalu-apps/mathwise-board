import { t } from "@/shared/i18n";
import { MobiusLoader } from "./MobiusLoader";

export type InlineMobiusLoaderSize = "hero" | "panel" | "compact" | "tiny";

type InlineMobiusLoaderProps = {
  label?: string;
  size?: InlineMobiusLoaderSize;
  className?: string;
  centered?: boolean;
  stacked?: boolean;
  decorative?: boolean;
};

export function InlineMobiusLoader({
  label,
  size = "panel",
  className,
  centered = false,
  stacked = false,
  decorative = false,
}: InlineMobiusLoaderProps) {
  const classes = [
    "ui-mobius-loader",
    `ui-mobius-loader--${size}`,
    centered ? "ui-mobius-loader--centered" : "",
    stacked ? "ui-mobius-loader--stacked" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const accessibilityProps = decorative
    ? {
        "aria-hidden": true,
      }
    : {
        role: "status" as const,
        "aria-live": "polite" as const,
        "aria-label": label ?? t("common.loading"),
      };

  return (
    <div className={classes} {...accessibilityProps}>
      <span className="ui-mobius-loader__spinner" aria-hidden="true">
        <MobiusLoader className="ui-loader__mobius" />
      </span>
      {label ? <span className="ui-mobius-loader__label">{label}</span> : null}
    </div>
  );
}
