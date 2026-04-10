let shuttingDown = false;

export const markRuntimeShuttingDown = () => {
  shuttingDown = true;
};

export const isRuntimeShuttingDown = () => shuttingDown;
