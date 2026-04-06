Audition still-cut prompt drafts for review.

Purpose:
- Preserve the user's exact identity from the physiognomy reference photo
- Apply the highest-scoring scene genre as the cinematic direction
- Produce a premium Korean film still, not a selfie or poster

Suggested placeholders:
- `{{ASSIGNED_ROLE}}`
- `{{SCENE_CUE}}`
- `{{ARCHETYPE}}`
- `{{SCREEN_IMPRESSION}}`
- `{{CASTING_FRAME}}`

Current backend runtime:
- Image generation route: `/api/audition/generate`
- Model: `gemini-3.1-flash-image-preview`

Files:
- `base-movie-still.txt`: global still-cut rules
- One `.txt` file per audition genre for genre-specific art direction

