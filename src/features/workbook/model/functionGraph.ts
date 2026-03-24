import type { WorkbookPoint } from "./types";
import {
  WORKBOOK_GRAPH_COLORS,
  WORKBOOK_SYSTEM_COLORS,
} from "./workbookVisualColors";

export type GraphFunctionDraft = {
  id: string;
  expression: string;
  color: string;
  visible: boolean;
  dashed?: boolean;
  width?: number;
  offsetX?: number;
  offsetY?: number;
  scaleX?: number;
  scaleY?: number;
};

export type FunctionGraphPreset = {
  id: string;
  title: string;
  expression: string;
  description: string;
  color?: string;
};

type GraphViewport = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type CompiledGraphExpression = (x: number) => number | null;

export type FunctionGraphPlot = {
  id: string;
  expression: string;
  color: string;
  width: number;
  dashed: boolean;
  segments: WorkbookPoint[][];
  offsetX: number;
  offsetY: number;
  scaleX: number;
  scaleY: number;
};

const MIN_GRID_STEP = 12;
const MAX_GRID_STEP = 64;
const MIN_GRAPH_SCALE_ABS = 0.1;
const MAX_GRAPH_SCALE_ABS = 12;
const MAX_COMPILED_CACHE_SIZE = 240;
const MAX_EXPRESSION_LENGTH = 180;
const SAFE_EXPRESSION_PATTERN = /^[0-9a-z+\-*/^().,_]+$/i;
const ALLOWED_EXPRESSION_IDENTIFIERS = new Set([
  "x",
  "pi",
  "e",
  "abs",
  "sqrt",
  "sin",
  "cos",
  "tan",
  "cot",
  "log",
  "log10",
]);

export const GRAPH_FUNCTION_COLORS = [...WORKBOOK_GRAPH_COLORS];

export const FUNCTION_GRAPH_PRESETS: FunctionGraphPreset[] = [
  {
    id: "linear",
    title: "Линейная",
    expression: "y = x",
    description: "Прямая",
    color: WORKBOOK_GRAPH_COLORS[0],
  },
  {
    id: "parabola",
    title: "Парабола",
    expression: "y = x^2",
    description: "Квадратичная",
    color: WORKBOOK_GRAPH_COLORS[3],
  },
  {
    id: "cube",
    title: "Кубическая",
    expression: "y = x^3",
    description: "Полином 3-й степени",
    color: WORKBOOK_GRAPH_COLORS[1],
  },
  {
    id: "hyperbola",
    title: "Гипербола",
    expression: "y = 1 / x",
    description: "Обратная пропорциональность",
    color: WORKBOOK_SYSTEM_COLORS.warning,
  },
  {
    id: "modulus",
    title: "Модуль",
    expression: "y = abs(x)",
    description: "Функция модуля",
    color: WORKBOOK_GRAPH_COLORS[4],
  },
  {
    id: "root",
    title: "Корень",
    expression: "y = sqrt(x)",
    description: "Квадратный корень",
    color: WORKBOOK_GRAPH_COLORS[5],
  },
  {
    id: "sine",
    title: "Синус",
    expression: "y = sin(x)",
    description: "Тригонометрическая",
    color: WORKBOOK_GRAPH_COLORS[6],
  },
  {
    id: "cosine",
    title: "Косинус",
    expression: "y = cos(x)",
    description: "Тригонометрическая",
    color: WORKBOOK_GRAPH_COLORS[4],
  },
  {
    id: "exponential",
    title: "Экспонента",
    expression: "y = e^x",
    description: "Показательная",
    color: WORKBOOK_SYSTEM_COLORS.danger,
  },
  {
    id: "logarithm",
    title: "Логарифм",
    expression: "y = ln(x)",
    description: "Натуральный логарифм",
    color: WORKBOOK_SYSTEM_COLORS.secondary,
  },
];

const compiledExpressionCache = new Map<string, CompiledGraphExpression>();

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export const normalizeGraphScale = (value: number, fallback = 1): number => {
  if (!Number.isFinite(value)) {
    const safeFallback = Number.isFinite(fallback) && Math.abs(fallback) >= MIN_GRAPH_SCALE_ABS
      ? fallback
      : 1;
    return clamp(safeFallback, -MAX_GRAPH_SCALE_ABS, MAX_GRAPH_SCALE_ABS);
  }
  if (Math.abs(value) < MIN_GRAPH_SCALE_ABS) {
    if (value > 0) return MIN_GRAPH_SCALE_ABS;
    if (value < 0) return -MIN_GRAPH_SCALE_ABS;
    return fallback < 0 ? -MIN_GRAPH_SCALE_ABS : MIN_GRAPH_SCALE_ABS;
  }
  return clamp(value, -MAX_GRAPH_SCALE_ABS, MAX_GRAPH_SCALE_ABS);
};

const ensureCompiledCacheSize = () => {
  while (compiledExpressionCache.size > MAX_COMPILED_CACHE_SIZE) {
    const oldestKey = compiledExpressionCache.keys().next().value;
    if (typeof oldestKey !== "string") break;
    compiledExpressionCache.delete(oldestKey);
  }
};

const hasBalancedParentheses = (expression: string): boolean => {
  let depth = 0;
  for (let index = 0; index < expression.length; index += 1) {
    const char = expression[index];
    if (char === "(") depth += 1;
    if (char === ")") {
      depth -= 1;
      if (depth < 0) return false;
    }
  }
  return depth === 0;
};

const compileGraphExpression = (expression: string): CompiledGraphExpression | null => {
  if (!expression || expression.length > MAX_EXPRESSION_LENGTH) {
    return null;
  }
  if (!SAFE_EXPRESSION_PATTERN.test(expression)) {
    return null;
  }
  if (!hasBalancedParentheses(expression)) {
    return null;
  }
  const identifierMatches = expression.match(/[a-z_]+/gi) ?? [];
  for (const token of identifierMatches) {
    const normalized = token.toLowerCase();
    if (!ALLOWED_EXPRESSION_IDENTIFIERS.has(normalized)) {
      return null;
    }
  }
  const jsExpression = expression.replace(/\^/g, "**");
  try {
    const evaluator = new Function(
      "x",
      "pi",
      "e",
      "abs",
      "sqrt",
      "sin",
      "cos",
      "tan",
      "cot",
      "log",
      "log10",
      `"use strict"; return (${jsExpression});`
    ) as (
      x: number,
      pi: number,
      e: number,
      abs: (value: number) => number,
      sqrt: (value: number) => number,
      sin: (value: number) => number,
      cos: (value: number) => number,
      tan: (value: number) => number,
      cot: (value: number) => number,
      log: (value: number) => number,
      log10: (value: number) => number
    ) => unknown;

    return (x: number): number | null => {
      try {
        const value = evaluator(
          x,
          Math.PI,
          Math.E,
          Math.abs,
          Math.sqrt,
          Math.sin,
          Math.cos,
          Math.tan,
          (arg) => 1 / Math.tan(arg),
          Math.log,
          Math.log10
        );
        if (typeof value === "number" && Number.isFinite(value)) {
          return value;
        }
        if (typeof value === "string" && value.trim()) {
          const casted = Number(value);
          return Number.isFinite(casted) ? casted : null;
        }
        return null;
      } catch {
        return null;
      }
    };
  } catch {
    return null;
  }
};

const getCompiledExpression = (expression: string): CompiledGraphExpression | null => {
  const cached = compiledExpressionCache.get(expression);
  if (cached) return cached;
  const compiled = compileGraphExpression(expression);
  if (!compiled) {
    return null;
  }
  compiledExpressionCache.set(expression, compiled);
  ensureCompiledCacheSize();
  return compiled;
};

const evaluateCompiledExpression = (
  compiled: CompiledGraphExpression,
  x: number
): number | null => compiled(x);

export const normalizeFunctionExpression = (value: string): string => {
  let expression = value.trim();
  expression = expression.replace(/^f\s*\(\s*x\s*\)\s*=\s*/i, "");
  expression = expression.replace(/^y\s*=\s*/i, "");
  expression = expression.replace(/[−–—]/g, "-");
  expression = expression.replace(/π/gi, "pi");
  expression = expression.replace(/√/g, "sqrt");
  expression = expression.replace(/(\d),(\d)/g, "$1.$2");
  expression = expression.replace(/\s+/g, "");
  expression = expression.replace(/\bX\b/g, "x");
  expression = expression.replace(/\bLn\(/g, "ln(");
  expression = expression.replace(/\bLG\(/g, "lg(");
  expression = expression.replace(/\bTG\(/g, "tg(");
  expression = expression.replace(/\bCTG\(/g, "ctg(");
  expression = expression.replace(/\btg\(/gi, "tan(");
  expression = expression.replace(/\bctg\(/gi, "cot(");
  expression = expression.replace(/\bln\(/gi, "log(");
  expression = expression.replace(/\blg\(/gi, "log10(");
  expression = expression.replace(/x\(/gi, "x*(");
  expression = expression.replace(/\)(x|\d)/gi, ")*$1");
  expression = expression.toLowerCase();
  return expression;
};

export const validateFunctionExpression = (
  rawExpression: string
): {
  ok: boolean;
  expression: string;
  error?: string;
} => {
  const expression = normalizeFunctionExpression(rawExpression);
  if (!expression) {
    return {
      ok: false,
      expression,
      error: "Введите формулу функции.",
    };
  }
  const compiled = getCompiledExpression(expression);
  if (!compiled) {
    return {
      ok: false,
      expression,
      error: "Формула содержит ошибку. Проверьте синтаксис.",
    };
  }
  return {
    ok: true,
    expression,
  };
};

export const isFunctionExpressionValid = (rawExpression: string): boolean =>
  validateFunctionExpression(rawExpression).ok;

export const sanitizeFunctionGraphDrafts = (
  functions: GraphFunctionDraft[],
  options?: {
    ensureNonEmpty?: boolean;
  }
): GraphFunctionDraft[] => {
  const normalized = functions.reduce<GraphFunctionDraft[]>((acc, item, index) => {
    const validation = validateFunctionExpression(item.expression);
    if (!validation.ok) return acc;
    return [
      ...acc,
      {
        id: item.id || `graph-${index}`,
        expression: validation.expression,
        color: item.color || GRAPH_FUNCTION_COLORS[index % GRAPH_FUNCTION_COLORS.length],
        visible: item.visible !== false,
        dashed: Boolean(item.dashed),
        width:
          typeof item.width === "number" && Number.isFinite(item.width)
            ? clamp(item.width, 1, 6)
            : 2,
        offsetX:
          typeof item.offsetX === "number" && Number.isFinite(item.offsetX)
            ? clamp(item.offsetX, -999, 999)
            : 0,
        offsetY:
          typeof item.offsetY === "number" && Number.isFinite(item.offsetY)
            ? clamp(item.offsetY, -999, 999)
            : 0,
        scaleX:
          normalizeGraphScale(item.scaleX ?? 1, 1),
        scaleY:
          normalizeGraphScale(item.scaleY ?? 1, 1),
      },
    ];
  }, []);
  if (!options?.ensureNonEmpty || normalized.length > 0) {
    return normalized;
  }
  return [
    {
      id: "default-graph-fn",
      expression: "x",
      color: GRAPH_FUNCTION_COLORS[0],
      visible: true,
      dashed: false,
      width: 2,
      offsetX: 0,
      offsetY: 0,
      scaleX: 1,
      scaleY: 1,
    },
  ];
};

export const buildFunctionGraphPlots = (
  functions: GraphFunctionDraft[],
  viewport: GraphViewport,
  gridStep: number
): FunctionGraphPlot[] => {
  const safeGridStep = clamp(Math.round(gridStep), MIN_GRID_STEP, MAX_GRID_STEP);
  const pxPerUnit = safeGridStep;
  const centerX = viewport.x + viewport.width / 2;
  const centerY = viewport.y + viewport.height / 2;
  const samplingStepPx = clamp(safeGridStep / 10, 0.9, 3.2);
  const samples = clamp(Math.round(viewport.width / samplingStepPx), 280, 2200);
  const dx = viewport.width / samples;
  const yVisibilityMargin = viewport.height * 1.8;

  return functions
    .filter((item) => item.visible !== false)
    .map((item) => {
      const validation = validateFunctionExpression(item.expression);
      if (!validation.ok) return null;
      const compiled = getCompiledExpression(validation.expression);
      if (!compiled) return null;
      const offsetX =
        typeof item.offsetX === "number" && Number.isFinite(item.offsetX)
          ? clamp(item.offsetX, -999, 999)
          : 0;
      const offsetY =
        typeof item.offsetY === "number" && Number.isFinite(item.offsetY)
          ? clamp(item.offsetY, -999, 999)
          : 0;
      const scaleX =
        normalizeGraphScale(item.scaleX ?? 1, 1);
      const scaleY =
        normalizeGraphScale(item.scaleY ?? 1, 1);

      const segments: WorkbookPoint[][] = [];
      let currentSegment: WorkbookPoint[] = [];
      let previousPoint: WorkbookPoint | null = null;

      const flushSegment = () => {
        if (currentSegment.length > 1) {
          segments.push(currentSegment);
        }
        currentSegment = [];
      };

      for (let index = 0; index <= samples; index += 1) {
        const localX = index * dx;
        const canvasX = viewport.x + localX;
        const x = (canvasX - centerX) / pxPerUnit;
        const normalizedX = (x - offsetX) / scaleX;
        const yValue = evaluateCompiledExpression(compiled, normalizedX);
        if (yValue == null) {
          flushSegment();
          previousPoint = null;
          continue;
        }
        const transformedY = yValue * scaleY + offsetY;
        const canvasY = centerY - transformedY * pxPerUnit;
        if (!Number.isFinite(canvasY)) {
          flushSegment();
          previousPoint = null;
          continue;
        }
        const outOfVisibleRange =
          canvasY < viewport.y - yVisibilityMargin ||
          canvasY > viewport.y + viewport.height + yVisibilityMargin;
        if (outOfVisibleRange) {
          flushSegment();
          previousPoint = null;
          continue;
        }
        const point: WorkbookPoint = {
          x: canvasX,
          y: canvasY,
        };
        if (previousPoint) {
          const dy = Math.abs(point.y - previousPoint.y);
          const slope = dy / Math.max(0.5, dx);
          const jumpDetected = dy > viewport.height * 0.9 && slope > 26;
          if (jumpDetected) {
            flushSegment();
            currentSegment.push(point);
            previousPoint = point;
            continue;
          }
        }
        currentSegment.push(point);
        previousPoint = point;
      }

      flushSegment();
      return {
        id: item.id,
        expression: validation.expression,
        color: item.color || WORKBOOK_GRAPH_COLORS[0],
        width:
          typeof item.width === "number" && Number.isFinite(item.width)
            ? clamp(item.width, 1, 6)
            : 2,
        dashed: Boolean(item.dashed),
        segments,
        offsetX,
        offsetY,
        scaleX,
        scaleY,
      } satisfies FunctionGraphPlot;
    })
    .filter((item): item is FunctionGraphPlot => Boolean(item));
};

export const getDefaultGraphDraft = (): GraphFunctionDraft => ({
  id: "default-graph-fn",
  expression: "x",
  color: GRAPH_FUNCTION_COLORS[0],
  visible: true,
  dashed: false,
  width: 2,
  offsetX: 0,
  offsetY: 0,
  scaleX: 1,
  scaleY: 1,
});

export const getSafeGraphStep = (value: number): number =>
  clamp(Math.round(value), MIN_GRID_STEP, MAX_GRID_STEP);

export const getAutoGraphGridStep = (
  viewport: Pick<GraphViewport, "width" | "height">
): number =>
  clamp(Math.round(Math.min(viewport.width, viewport.height) / 10), 18, 46);
