export type StyleFilterPrompt = {
  label: string;
  prompt: string;
};

export const STYLE_FILTER_PROMPTS: Record<string, StyleFilterPrompt> = {
  "soft-dreamy": {
    label: "몽글몽글",
    prompt: `The final image must read instantly as a dreamy washed film photo at first glance.
- Raise exposure slightly into a bright high-key range
- Apply a milky white veil across the whole image
- Strong soft diffusion over lights, skin, reflections, and wet pavement
- Bloom and halation around all bright areas, especially street lights and reflected highlights
- Lower global contrast noticeably
- Lift blacks and shadows so dark areas feel softer and more pastel
- Shift the overall color response toward pale sky blue, powder blue, soft cream, and light misty gray
- Desaturate harsh reds and greens slightly so the image feels pastel and airy
- Reduce micro-contrast and edge clarity
- Make the rain city scene feel soft, hazy, creamy, airy, and lightly overexposed
- The dreamy filter must be visibly obvious, not subtle
- No HDR
- No crisp digital sharpness
- No graphic border`,
  },
  "y2k-glossy": {
    label: "Y2K 글로시",
    prompt: `The final image must read instantly as an early-2000s glossy digital camera photo at first glance.
- Strongly increase saturation compared with the base card
- Push the image toward cool cyan-blue and slight magenta-pink bias
- Make traffic lights, street signage, and wet street reflections pop much more vividly
- Increase contrast and specular shine on wet surfaces
- Add glossy highlight rolloff, bright clipped-looking light spots, and shiny point-and-shoot flash-era finish
- Keep skin real, but give the whole image a polished glossy print look
- Make the blue-gray sky cooler and cleaner
- Make reds, greens, and amber lights feel brighter and more synthetic in a 2000s digicam way
- Slight low-dynamic-range digital compression feel is allowed
- The Y2K glossy filter must be visibly obvious, not subtle
- No film grain
- No HDR
    - No cinematic muted grading
    - No graphic border`,
  },
  "film-bokeh": {
    label: "필름 보케",
    prompt: `The final image must read instantly as a pastel soft-focus film photo with visible atmospheric bokeh at first glance.
- Add soft milky glow over the whole frame
- Introduce visible dreamy bokeh and diffused highlight bloom around street lights and wet reflections
- Shift the overall palette toward pastel blue, pale peach, washed cream, and gentle fog gray
- Lower contrast clearly from the default version
- Lift blacks and soften shadow transitions
- Reduce edge sharpness and micro-contrast so the image feels airy and filtered
- Let rain reflections feel blurred and glowing rather than crisp
- Make the whole frame feel soft, hazy, and slightly faded
- The film bokeh finish must be visibly obvious, not subtle
- No HDR
- No hard digital clarity
- No graphic border`,
  },
  "superia-400": {
    label: "Fujifilm Superia 400",
    prompt: `The final image must read instantly as a cool green-cyan Fujifilm-style film frame at first glance.
- Shift the palette toward cyan-green, cool blue, and subdued neutral gray
- Push shadows slightly greener and cooler than the default version
- Keep highlights pale and a little flat, with a consumer-film scan feel
- Lower red warmth and reduce golden street-light dominance
- Add subtle muted saturation with cool film color separation
- Slightly flatten tonal depth so the image feels scanned from color negative film
- Keep wet pavement reflections cooler and more teal than orange
- Allow a mild soft grain impression without obvious digital crispness
- The Superia-style finish must be visibly obvious, not subtle
- No HDR
- No glossy digital finish
- No graphic border`,
  },
  "fade-out": {
    label: "페이드 아웃",
    prompt: `The final image must read instantly as a heavily washed-out high-key faded photograph at first glance.
- Push exposure brighter than the default version
- Add a pale white wash across the entire frame
- Strongly lower contrast
- Lift blacks and midtones so the whole image feels bleached and matte
- Reduce saturation noticeably across all colors
- Make the rainy street feel misty, pale, airy, and near-white in the highlights
- Keep details visible but soften their separation
- Let the whole image feel faded, delicate, and softly overexposed
- The fade-out effect must be visibly obvious, not subtle
- No HDR
- No punchy blacks
- No glossy saturation
- No graphic border`,
  },
  "digicam-warm": {
    label: "디카 웜톤",
    prompt: `The final image must read instantly as an early low-light consumer digicam photo with warm yellow bias at first glance.
- Shift the whole frame toward yellow, amber, and slightly muddy warm tones
- Push the sky and cool areas warmer and duller than the default version
- Lower dynamic range so the image feels like an older compact digital camera
- Keep contrast modest and slightly flat
- Add light sensor-noise feeling and mild low-light roughness without destroying realism
- Let street lamps and reflected highlights feel warmer and more direct
- Keep whites slightly dirty instead of pure white
- Make the whole rainy city frame feel warm, blunt, casual, and early-digital
- The digicam warm finish must be visibly obvious, not subtle
- No HDR
- No premium glossy polish
- No graphic border`,
  },
  "portra-400": {
    label: "Kodak Portra 400",
    prompt: `The final image must read instantly as a warm Portra-style color negative photograph at first glance.
- Shift the palette toward warm orange, cream, beige, and soft golden tones
- Keep skin tones creamy and slightly luminous
- Soften blues so they lean gentler and less electric than the default version
- Reduce harsh contrast and create smooth tonal transitions
- Give highlights a creamy, rounded response rather than sharp clipping
- Let street reflections feel warm and elegant, not neon
- Add a subtle soft grain impression and filmic smoothness
- Make the whole image feel warm, premium, and lightly nostalgic
- The Portra-style finish must be visibly obvious, not subtle
- No HDR
- No harsh cyan cast
- No graphic border`,
  },
  "cool-blue-haze": {
    label: "쿨 블루 헤이즈",
    prompt: `The final image must read instantly as a cold blue hazy overexposed photograph at first glance.
- Push the entire palette toward cool blue, steel blue, and pale cyan
- Add a lifted cool exposure wash across the whole frame
- Introduce soft haze and mist over the rainy street
- Lower saturation in warm colors so blues dominate the image mood
- Make highlights feel bright, cold, and lightly overexposed
- Soften contrast and edge definition
- Let the whole city feel cooler, quieter, and more distant than the default version
- Maintain a clean cold mood instead of warm nostalgia
- The cool blue haze finish must be visibly obvious, not subtle
- No HDR
- No warm orange bias
- No graphic border`,
  },
  "retro-70s": {
    label: "레트로 70s",
    prompt: `The final image must read instantly as a warm retro 1970s photograph at first glance.
- Shift the whole frame toward brown, tan, mustard, faded orange, and earthy neutrals
- Warm the image globally and suppress modern cool blue clarity
- Lower digital sharpness and make the tonal response feel older and softer
- Add gentle shadow richness with brownish undertones
- Keep highlights warm and slightly dusty rather than clean white
- Let the rainy city reflections feel earthy and nostalgic instead of slick and modern
- Reduce clinical contrast and add a vintage print feeling
- Make the whole image feel analog, aged, and warmly retro
- The retro 70s finish must be visibly obvious, not subtle
- No HDR
- No cool modern grading
- No graphic border`,
  },
};

export const STYLE_FILTER_ENABLED_STYLES = new Set([
  "rainy-crosswalk",
]);

export function appendStyleFilterPrompt(basePrompt: string, filter: StyleFilterPrompt) {
  return `STYLE FILTER PRIORITY — ${filter.label}:
Apply this filter as the dominant final color science and finishing pass for the image.
If the base prompt's COLOR, PHOTO STYLE, LIGHTING FINISH, or MOOD sections conflict with this filter, preserve the base scene and identity but prioritize this filter's final visual output.
The difference from the default version must be visually obvious at first glance.
This is one combined image generation instruction, not a second generation step.

${filter.prompt}

BASE CARD PROMPT:
${basePrompt}

STYLE FILTER STRICT RULES:
- Keep the exact same card scene, story concept, wardrobe intent, and identity rules from the base prompt
- Do not replace the environment with a different scene
- Do not remove key props or environmental elements from the base prompt
- Apply the filter strongly enough that the result is clearly distinguishable from the default version
- Change only final photographic finish, color response, contrast behavior, bloom, haze, gloss, clarity, and tonal texture
- Do not create graphic borders, text, stickers, or film frames
- The final output must still look like one real high-resolution photograph`;
}
