import {
  AUDITION_ENABLED,
  NABO_LAB_ENABLED,
  PERSONAL_COLOR_LAB_ENABLED,
  TRAVEL_TOGETHER_LAB_ENABLED,
} from "@/lib/feature-flags";
import { ALL_STYLES, type StyleDef } from "@/lib/styles";

export type StyleControlRow = {
  style_id: string;
  is_visible: boolean;
  is_enabled: boolean;
  disabled_reason: string | null;
  updated_at?: string | null;
};

export type StyleControlState = StyleControlRow & {
  style_name: string;
};

export const AUDITION_CONTROL_ID = "audition";
export const AUDITION_CONTROL_NAME = "AI 오디션";
export const PERSONAL_COLOR_CONTROL_ID = "personal-color";
export const PERSONAL_COLOR_CONTROL_NAME = "퍼스널 컬러";
export const NABO_CONTROL_ID = "nabo";
export const NABO_CONTROL_NAME = "내가 보는 너";
export const TRAVEL_TOGETHER_CONTROL_ID = "travel_together";
export const TRAVEL_TOGETHER_CONTROL_NAME = "여행을 같이 간다면";

function buildFeatureControls(): StyleControlState[] {
  return [
    {
      style_id: AUDITION_CONTROL_ID,
      style_name: AUDITION_CONTROL_NAME,
      is_visible: AUDITION_ENABLED,
      is_enabled: AUDITION_ENABLED,
      disabled_reason: null,
      updated_at: null,
    },
    {
      style_id: PERSONAL_COLOR_CONTROL_ID,
      style_name: PERSONAL_COLOR_CONTROL_NAME,
      is_visible: PERSONAL_COLOR_LAB_ENABLED,
      is_enabled: PERSONAL_COLOR_LAB_ENABLED,
      disabled_reason: null,
      updated_at: null,
    },
    {
      style_id: NABO_CONTROL_ID,
      style_name: NABO_CONTROL_NAME,
      is_visible: NABO_LAB_ENABLED,
      is_enabled: NABO_LAB_ENABLED,
      disabled_reason: null,
      updated_at: null,
    },
    {
      style_id: TRAVEL_TOGETHER_CONTROL_ID,
      style_name: TRAVEL_TOGETHER_CONTROL_NAME,
      is_visible: TRAVEL_TOGETHER_LAB_ENABLED,
      is_enabled: TRAVEL_TOGETHER_LAB_ENABLED,
      disabled_reason: null,
      updated_at: null,
    },
  ];
}

export function buildDefaultStyleControls(): StyleControlState[] {
  return [
    ...ALL_STYLES.map((style) => ({
      style_id: style.id,
      style_name: style.name,
      is_visible: !style.hidden,
      is_enabled: style.active,
      disabled_reason: null,
      updated_at: null,
    })),
    ...buildFeatureControls(),
  ];
}

export function mergeStyleControls(rows: StyleControlRow[] = []): StyleControlState[] {
  const defaults = buildDefaultStyleControls();
  const rowMap = new Map(rows.map((row) => [row.style_id, row]));

  return defaults.map((base) => {
    const override = rowMap.get(base.style_id);
    return override
      ? {
          ...base,
          ...override,
          style_name: base.style_name,
        }
      : base;
  });
}

export function styleControlsToMap(rows: StyleControlState[]): Record<string, StyleControlState> {
  return Object.fromEntries(rows.map((row) => [row.style_id, row]));
}

export function resolveFeatureControlState(
  control: Pick<StyleControlState, "is_visible" | "is_enabled"> | undefined,
  fallbackEnabled: boolean
) {
  return {
    is_visible: control?.is_visible ?? fallbackEnabled,
    is_enabled: control?.is_enabled ?? fallbackEnabled,
  };
}

export function applyStyleControl(style: StyleDef, control?: Pick<StyleControlState, "is_visible" | "is_enabled">): StyleDef {
  if (!control) return style;
  return {
    ...style,
    hidden: !control.is_visible,
    active: control.is_enabled,
  };
}
