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

export function buildDefaultStyleControls(): StyleControlState[] {
  return ALL_STYLES.map((style) => ({
    style_id: style.id,
    style_name: style.name,
    is_visible: !style.hidden,
    is_enabled: style.active,
    disabled_reason: null,
    updated_at: null,
  }));
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

export function applyStyleControl(style: StyleDef, control?: Pick<StyleControlState, "is_visible" | "is_enabled">): StyleDef {
  if (!control) return style;
  return {
    ...style,
    hidden: !control.is_visible,
    active: control.is_enabled,
  };
}
