type MobiusLoaderProps = {
  className?: string;
};

const MOBIUS_PATH =
  "M 18 56 C 18 27 48 21 66 42 C 77 55 83 57 94 42 C 112 21 142 27 142 56 C 142 85 112 91 94 70 C 83 57 77 55 66 70 C 48 91 18 85 18 56 Z";

export function MobiusLoader({ className }: MobiusLoaderProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 160 112"
      role="presentation"
      aria-hidden="true"
    >
      <path
        className="ui-loader__mobius-track"
        d={MOBIUS_PATH}
        pathLength={100}
      />
      <path
        className="ui-loader__mobius-accent"
        d={MOBIUS_PATH}
        pathLength={100}
      />
    </svg>
  );
}
