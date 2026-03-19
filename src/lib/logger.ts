/**
 * Development-mode logger utilities
 *
 * These helpers wrap console methods and only execute in development mode,
 * preventing information leakage in production.
 *
 * @note Important: Function arguments are evaluated BEFORE entering the function.
 * This means `devLog(expensiveComputation())` will still call expensiveComputation()
 * in production, even though nothing gets logged. For expensive operations, use:
 *   if (import.meta.env.DEV) { expensiveComputation(); }
 */

// Check at module load time for slightly better tree-shaking
const IS_DEV = import.meta.env.DEV;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const devLog = (...args: any[]): void => {
  if (IS_DEV) {
    console.debug(...args);
  }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const devInfo = (...args: any[]): void => {
  if (IS_DEV) {
    console.info(...args);
  }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const devWarn = (...args: any[]): void => {
  if (IS_DEV) {
    console.warn(...args);
  }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const devError = (...args: any[]): void => {
  if (IS_DEV) {
    console.error(...args);
  }
};
