const TRUTHY_FLAG_VALUES = new Set(["1", "true", "yes", "on", "enabled"]);

const toBooleanFlag = (value: unknown) => {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return false;
  return TRUTHY_FLAG_VALUES.has(value.trim().toLowerCase());
};

export const isWorkbookZustandStoreEnabled = () =>
  toBooleanFlag(
    import.meta.env.VITE_FF_ZUSTAND_STORE ??
      import.meta.env.VITE_FF_FRONTEND_ZUSTAND_STORE ??
      import.meta.env.VITE_FF_FRONTEND_ZUSTAND ??
      ""
  );

