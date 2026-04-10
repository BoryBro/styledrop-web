Long-form audition still-cut prompt system.

Goal:
- Preserve the user's original high-control prompt density.
- Avoid duplicating unchanged identity-preservation logic 30 times.
- Produce a final prompt that is as detailed as the original base prompt by combining:
  1. `MASTER_PROMPT_TEMPLATE.txt`
  2. one genre file
  3. one variation block within that genre file

How to use:
- Keep `MASTER_PROMPT_TEMPLATE.txt` as the fixed base.
- For a chosen genre variation, replace the matching placeholder sections in the master template.
- The resulting prompt should remain as long, strict, and explicit as the original supplied logic.

Sections expected from each variation:
- `INTRO`
- `POSE_EXPRESSION`
- `SCENE`
- `LIGHTING`
- `FILTER_DREAM_EFFECT`
- `PHOTO_STYLE`
- `COLOR`
- `MOOD`
- `STRICT_RULES_APPEND`
- `OUTPUT_TARGET_APPEND`

Genres included:
- action
- crime
- fantasy
- horror
- melo
- romance
- comedy
- daily
- psycho
- thriller
