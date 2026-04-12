import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { addWatermark } from "@/lib/watermark";
import { logGenerationError } from "@/lib/generation-errors.server";
import { loadStyleControlMap } from "@/lib/style-controls.server";
import { STYLE_LABELS } from "@/lib/styles";
import {
  GUEST_LIMIT, WINDOW_MS,
  GUEST_COOKIE,
  parseLimitCookie, encodeLimitCookie,
} from "@/lib/rate-limit";

function parseSession(request: NextRequest): { id: string; nickname: string } | null {
  try {
    const cookie = request.cookies.get("sd_session")?.value;
    if (!cookie) return null;
    return JSON.parse(Buffer.from(cookie, "base64").toString());
  } catch { return null; }
}

const STYLE_CONFIGS: Record<string, { temperature?: number; topP?: number; topK?: number }> = {};

const STRICT_IDENTITY_LOCK = `IDENTITY LOCK — NON-NEGOTIABLE:
- Preserve the exact same person from the uploaded photo
- Keep the same face shape, bone structure, eye shape, nose, lips, jawline, and recognizable identity
- Keep skin tone family and ethnicity consistent
- Do not replace the subject with a generic model
- If any style instruction conflicts with identity preservation, preserve identity first`;

const SELFIE_REALISM_LOCK = `FACE & CAMERA:
- Keep the subject instantly recognizable as the original user
- Preserve believable face proportions and hairline
- Maintain a natural selfie or portrait feel, not an over-generated fantasy face
- Do not over-smooth the face or erase unique facial details`;

const HUMOR_REALISM_LOCK = `REAL-WORLD HUMOR LOCK:
- The image should be funny because of the situation, outfit, prop, or setting, not because the face is distorted
- Keep the subject as the same recognizable person
- Make it feel like a real candid or documentary photo someone accidentally took
- Avoid cartoonish exaggeration, meme text, stickers, or surreal effects
- One person only, clear focus, believable Korean everyday setting`;

// 2D 구조: STYLE_PROMPTS[styleId][variant]
// 서브 옵션이 없는 스타일은 "default" 키만 가짐
const STYLE_PROMPTS: Record<string, Record<string, string>> = {
  // v1 (2026-03-30): 복셀/블록 캐릭터 변환
  "voxel-character": {
    "default": "Transform this photo into a voxel block-art 3D character. Recreate the subject as a full-body blocky character built entirely from cubic voxel blocks.\\n\\nIDENTITY — PRESERVE THESE DETAILS:\\n- Clothing colors, patterns, and outfit composition: identical to original\\n- Hair color, hairstyle, and length: identical\\n- Skin tone: identical\\n- Accessories (glasses, jewelry, bag, hat): all included\\n- Overall proportions should reflect the original person\\n\\nVOXEL STYLE REQUIREMENTS:\\n- Full-body character visible from head to toe\\n- All body parts built from cubic voxel/block units\\n- Blocky pixel-art aesthetic — no smooth curves anywhere\\n- Face: simple square pixels for eyes (white blocks with dark pupils), minimal nose dot, simple flat mouth\\n- Hands: blocky square paddle hands — no individual fingers\\n- Feet: flat rectangular block shoes\\n\\nRENDERING:\\n- 3D voxel render with subtle directional shading on each block face\\n- Clean solid white background\\n- Slight 3/4 front-facing angle\\n- High resolution, perfectly sharp block edges\\n- Flat matte colors per block — no photorealistic textures\\n- Character fully centered, entire body in frame with small margin\\n\\nAESTHETIC: 3D block builder toy meets game character sprite. Colorful, fun, and immediately recognizable as the original person through their outfit and colors.",
  },
  // v4 (2026-03-31): 얼굴 각도/표정/구도 고정 강화
  "flash-selfie": {
    "default": "Apply a direct on-camera flash lighting effect to this photo. ONLY change the lighting. Change nothing else.\n\nFACE & IDENTITY — MUST BE PIXEL-PERFECT IDENTICAL:\n- The person's face direction, head tilt, and camera-facing angle must be exactly the same as the original\n- Eye gaze direction, eye openness, eyebrow position: identical\n- Mouth shape, smile or neutral expression: identical — do not alter even slightly\n- Same person, same face, same skin tone, same facial structure\n- Same hairstyle, hair color, hair position\n- Same clothing, accessories, body pose\n\nCOMPOSITION — MUST NOT CHANGE:\n- Same framing, same crop, same aspect ratio\n- Same camera-to-subject distance\n- Same background elements and their positions\n\nLIGHTING CHANGE ONLY:\n- Add harsh, bright frontal flash hitting the subject directly\n- Glossy light reflections and slight overexposure on skin\n- Hard-edged shadows cast behind the subject on walls/surfaces\n- Background darker than flash-lit foreground (vignette)\n- Smooth, airbrushed, slightly glossy skin finish from flash\n\nMOOD: iPhone night flash or Y2K digicam party shot feel. Slight digital noise.",
  },
  // v3 (2026-03-31): 랜덤 3안 — v1 텍스트전용 / v2 ref-1 스타일 따라가기 / v3 ref-2 스타일 따라가기
  "joseon-farmer": {
    // v1 — 레퍼런스 없음, 순수 텍스트 프롬프트 (원본)
    "v1": "Transform this photo into a Joseon Dynasty Korean farmer portrait.\n\nThis must look like a real historical photograph from 1900–1920s Korea — completely unretouched, raw, aged, and documentary. Not artistic. Not stylized. Real.\n\nFACE — PRESERVE IDENTITY, INTEGRATE NATURALLY:\n- Preserve the person's facial features: bone structure, eye shape, nose, lips, proportions\n- Same expression and gaze direction\n- CRITICAL: The face must feel naturally integrated into the scene — same lighting direction, same contrast, same film grain texture as the rest of the image\n- The face must NOT look like it was pasted onto a different body\n- Match the neck and face seamlessly into the body and scene\n- Apply the same sepia/aged photo tone uniformly across the face and body\n- No beautification, no modern skin smoothing\n- Add surface weathering: sun damage, rough pores, uneven skin tone from outdoor labor\n\nHAIR — MUST CHANGE COMPLETELY:\n- Do NOT preserve the original hairstyle under any circumstances\n- Replace with authentic Joseon-era male farmer hair\n- Options: small topknot (상투) tied at the crown, OR very short roughly-cut hair typical of poor laborers\n- Hair must look unwashed, coarse, and unstyled\n- No modern haircut shapes, no volume, no styling\n\nCLOTHING:\n- Traditional Korean hemp work clothing (삼베옷)\n- Loose jeogori top and wide baji pants tied at ankles\n- Coarse, rough, worn fabric — visible fibers, stretched seams\n- Dirt stains, sweat marks embedded into fabric\n- No clean edges, no modern tailoring\n\nSCENE:\n- Wide dry Korean farmland, flat horizon, harvested field\n- Yellow-brown dry grass and soil\n- Pale overcast sky, flat harsh natural daylight\n- Holding a simple wooden farming tool (hoe or rake)\n- Full body visible head to toe\n\nPHOTOGRAPH QUALITY:\n- Early 1900s glass plate photograph\n- Heavy coarse analog film grain across entire image including face\n- Slight global softness, no sharp edges\n- No HDR, no digital sharpening\n- Low contrast, washed-out highlights, lifted blacks\n- Sepia/warm brown overall tone applied uniformly to entire image\n- Slight degradation as if scanned from aged print\n- Feels like a 100+ year-old archived Korean photograph\n- Must NOT look like a filter or modern composite\n- Raw, documentary, physically aged",

    // v3 — 자연/야외 씬 직접 묘사
    "v3": "Transform this photo into a Joseon Dynasty Korean farmer portrait.\n\nThis must look like a real historical photograph from 1900–1920s Korea — completely unretouched, raw, aged, and documentary. Not artistic. Not stylized. Real.\n\nFACE — PRESERVE IDENTITY, INTEGRATE NATURALLY:\n- Preserve the person's facial features: bone structure, eye shape, nose, lips, proportions\n- Same expression and gaze direction\n- CRITICAL: The face must feel naturally integrated into the scene — same lighting direction, same contrast, same film grain texture as the rest of the image\n- The face must NOT look like it was pasted onto a different body\n- Match the neck and face seamlessly into the body and scene\n- Apply the same sepia/aged photo tone uniformly across the face and body\n- No beautification, no modern skin smoothing\n- Add surface weathering: sun damage, rough pores, uneven skin tone from outdoor labor\n\nHAIR — MUST CHANGE COMPLETELY:\n- Do NOT preserve the original hairstyle under any circumstances\n- Replace with authentic Joseon-era male farmer hair\n- Options: small topknot (상투) tied at the crown, OR very short roughly-cut hair typical of poor laborers\n- Hair must look unwashed, coarse, and unstyled\n- No modern haircut shapes, no volume, no styling\n\nCLOTHING:\n- Traditional Korean hemp work clothing (삼베옷)\n- Loose jeogori top and wide baji pants tied at ankles\n- Coarse, rough, worn fabric — visible fibers, stretched seams\n- Dirt stains, sweat marks embedded into fabric\n- No clean edges, no modern tailoring\n\nSCENE:\n- A natural outdoor rural hillside setting with rough rocks, uneven ground, and wild vegetation\n- Subject is seated directly on a rock or dirt surface, centered in frame\n- Background consists of dense, untrimmed plants, dry leaves, and natural terrain (not farmland horizon)\n- No visible modern elements, no structures, no artificial objects\n- Static, documentary composition with subject facing camera directly\n- Medium-to-full body framing (knees or full seated body visible), grounded posture\n- Natural, unposed, slightly weary expression\n- Lighting is flat natural daylight, slightly diffused, no dramatic shadows\n\nPHOTOGRAPH QUALITY:\n- Early 1900s glass plate photograph\n- Heavy coarse analog film grain across entire image including face\n- Slight global softness, no sharp edges\n- No HDR, no digital sharpening\n- Low contrast, washed-out highlights, lifted blacks\n- Sepia/warm brown overall tone applied uniformly to entire image\n- Slight degradation as if scanned from aged print\n- Feels like a 100+ year-old archived Korean photograph\n- Must NOT look like a filter or modern composite\n- Raw, documentary, physically aged",

    // v5 — 스튜디오 씬 직접 묘사
    "v5": "Transform this photo into a Joseon Dynasty Korean farmer portrait.\n\nThis must look like a real historical photograph from 1900–1920s Korea — completely unretouched, raw, aged, and documentary. Not artistic. Not stylized. Real.\n\nFACE — PRESERVE IDENTITY, INTEGRATE NATURALLY:\n- Preserve the person's facial features: bone structure, eye shape, nose, lips, proportions\n- Same expression and gaze direction\n- CRITICAL: The face must feel naturally integrated into the scene — same lighting direction, same contrast, same film grain texture as the rest of the image\n- The face must NOT look like it was pasted onto a different body\n- Match the neck and face seamlessly into the body and scene\n- Apply the same sepia/aged photo tone uniformly across the face and body\n- No beautification, no modern skin smoothing\n- Add surface weathering: sun damage, rough pores, uneven skin tone from outdoor labor\n\nHAIR — MUST CHANGE COMPLETELY:\n- Do NOT preserve the original hairstyle under any circumstances\n- Replace with authentic Joseon-era male farmer hair\n- Options: small topknot (상투) tied at the crown, OR very short roughly-cut hair typical of poor laborers\n- Hair must look unwashed, coarse, and unstyled\n- No modern haircut shapes, no volume, no styling\n\nCLOTHING:\n- Traditional Korean hemp work clothing (삼베옷)\n- Loose jeogori top and wide baji pants tied at ankles\n- Coarse, rough, worn fabric — visible fibers, stretched seams\n- Dirt stains, sweat marks embedded into fabric\n- No clean edges, no modern tailoring\n\nSCENE:\n- Neutral studio-like plain backdrop with no visible environment context\n- Flat wall or backdrop with subtle texture, slightly worn or aged surface\n- Subject standing upright, centered in frame, facing camera directly\n- Full body visible from head to bare feet\n- Feet grounded naturally, slightly apart, stable stance\n- Holding a simple thin stick or farming tool loosely in one hand\n- Minimal composition, no additional objects or scenery\n- Static, documentary posture with no stylization\n- Lighting is flat, frontal or slightly top-down natural light, evenly distributed, no dramatic shadows\n\nPHOTOGRAPH QUALITY:\n- Early 1900s glass plate photograph\n- Heavy coarse analog film grain across entire image including face\n- Slight global softness, no sharp edges\n- No HDR, no digital sharpening\n- Low contrast, washed-out highlights, lifted blacks\n- Sepia/warm brown overall tone applied uniformly to entire image\n- Slight degradation as if scanned from aged print\n- Feels like a 100+ year-old archived Korean photograph\n- Must NOT look like a filter or modern composite\n- Raw, documentary, physically aged",
  },
  // v4 (2026-03-31): 얼굴 보존 최우선 + 장면 합성
  "grab-selfie": {
    "default": "Composite this person into a motorcycle selfie scene. The face must be preserved exactly.\n\nFACE PRESERVATION — HIGHEST PRIORITY:\n- Copy the person's face from the original photo with zero changes\n- Face angle toward the camera: identical to the original photo\n- Head tilt and rotation: identical\n- Eye direction, eye openness: identical\n- Facial expression — every muscle position, smile or neutral: identical\n- Skin tone, facial features, hair: identical\n- Do NOT reinterpret or redraw the face. Transplant it as-is.\n\nSCENE: The person is the rear passenger on a motorcycle in a busy Southeast Asian city street, taking a high-angle selfie.\n\nSEATING: Person sits on the BACK SEAT behind the driver. Driver's back is visible in the lower foreground.\n\nCLOTHING: Replace any cold-weather clothing with lightweight summer clothes (casual short-sleeve shirt). Keep the face, hair, and accessories exactly as in the original.\n\nSCENE SETUP:\n- Person wears a plain solid-color helmet (no logos, no text) and black sunglasses\n- Driver in front: plain helmet (no logos), face mask, back facing camera\n- Moving motorcycle\n\nENVIRONMENT:\n- Busy Southeast Asian city street, glass high-rise buildings, green trees\n- Intense tropical midday sunlight — harsh direct sun, strong shadows\n- Other motorcycles and vehicles\n\nCAMERA:\n- High-angle selfie shot by rear passenger extending arm forward\n- Wide-angle phone front camera distortion\n- Windblown hair, slight background motion blur\n\nAESTHETIC: Vibrant hyper-realistic travel photo. Hot midday sun energy. No brand logos anywhere.",
  },
  // 천사 변신
  "angel": {
    "soft": `IDENTITY LOCK — NON-NEGOTIABLE:
The uploaded person's face must be preserved with 100% fidelity.
Keep the exact same bone structure, eye shape, nose, lips, proportions, and overall recognizable face.
Do NOT replace the person with a generic model or beautify into a different identity.
The result must be instantly recognizable as the same person from the original photo.
If any conflict arises between style and identity, preserve identity first.

TRANSFORMATION:
Place the uploaded person into a dreamy soft angel fantasy portrait.

FACE & MAKEUP:
- Preserve all facial features exactly
- Apply luminous ethereal makeup: shimmery white/iridescent eyeshadow, crystal glitter around eyes, rhinestone under-eye accents, glossy soft pink lips, dewy luminous skin with pearlescent glow
- Skin should feel illuminated from within — bright, heavenly, smooth but human

HAIR:
- Keep the person's original hairstyle recognizable
- Refine into a soft, silky, weightless angelic version
- Long flowing hair, smooth glossy texture, gentle volume

OUTFIT:
- Flowing white angel dress: chiffon gown, ivory draped fabric, or soft celestial robe
- Light, airy, elegant, modest but beautiful

WINGS:
- Large soft white feathered angel wings behind the body
- Fluffy, glittering, translucent-shimmering, luminous
- Wings should frame the upper body elegantly

POSE:
- Gentle seated pose inside clouds
- Soft body language: relaxed shoulders, slightly tilted head, delicate hand placement
- Calm, composed, fragile posture

EXPRESSION:
- Calm, slightly melancholic, dreamy distant gaze
- Soft parted lips, serene stillness
- No big smiles

BACKGROUND:
- Surreal heavenly cloudscape: oversized fluffy fantasy clouds, glittering mist, soft white fog
- Pale silver-white atmosphere, dreamy cloud chamber
- Clouds feel intentionally unreal, fantastical, immersive

LIGHTING:
- Soft diffused frontal light, gentle bloom and glow
- Slightly overexposed heavenly light, no harsh shadows
- Pearlescent reflections, low-shadow angelic illumination

COLOR PALETTE:
- White, pearl, ivory, silver, soft pastel pink, pale cool gray, iridescent shimmer
- Airy, luminous, clean

MOOD:
- Tender, mystical, fragile, innocent, dreamy, ethereal
- Like a soft angelic perfume campaign mixed with fantasy portrait photography

STRICT RULES:
- Do NOT change the person's identity
- Do NOT make it dark, gothic, or edgy
- Do NOT lose the softness, haze, and glow
- Do NOT make the clouds realistic; they must feel surreal and heavenly`,

    "dark": `Transform the uploaded selfie into a surreal "fallen angel / dark cupid" fantasy portrait with a raw flash-photo aesthetic, while preserving the exact identity of the uploaded person.

CORE GOAL:
This is a selfie-to-stylized-portrait transformation for a filter card product.
The final image must feel like a dramatic editorial fantasy photo made from the user's own face and body presence, not a new character.
Preserve the uploaded person's identity very strongly: same facial structure, same eye shape, same nose, same lips, same proportions, same recognizable face. Do not replace the person with another model. Keep the subject instantly recognizable as the original user.

IDENTITY PRESERVATION:
- Preserve 100% of the uploaded person's facial identity.
- Keep the original bone structure, face width, jawline, eye spacing, nose bridge, lip shape, skin tone family, and overall recognizable look.
- Do not beautify into a different person.
- Do not change ethnicity.
- Do not alter body type drastically.
- Do not generate a random fashion model face.
- The result must feel like the same person wearing a themed fantasy filter and entering a constructed visual world.

OVERALL CONCEPT:
A seductive celestial-underworld angel portrait, mixing innocent angel symbolism with slightly rebellious, smoky, decadent, dark-romantic energy.
The mood should combine:
- angel wings
- cherub / cupid motifs
- red hearts and small stars
- cigarette smoke
- dreamy clouds or smoky void
- soft sinful glamour
- low-budget DIY fantasy set energy mixed with editorial styling
- nostalgic 2000s flash photography
- surreal campy digital collage aesthetics
- feminine, emotionally distant, slightly dangerous, soft but provocative mood

VISUAL STYLE:
- direct on-camera flash photography
- raw digital camera look
- slightly overexposed skin highlights from flash
- visible specular glow on cheeks, forehead, nose, collarbone, shoulders, legs
- simple staged composition
- collage-like fantasy elements floating around the subject
- soft haze, smoke wisps, cloudy atmosphere
- intentionally artificial but stylish visual world
- not cinematic realism; more like flash-shot fantasy editorial mixed with internet-era surreal glamour
- playful but dark, heavenly but corrupted, glamorous but handmade, dreamy and eerie at the same time

COMPOSITION:
Create a centered or slightly off-centered single-subject portrait.
The uploaded person should dominate the frame as the main visual anchor.
Use a medium full-body or 3/4-body composition.
Allow large wings to spread behind the subject and fill a major portion of the image.
Arrange floating decorative elements around the subject in an intentionally stylized, poster-like composition.
The frame should feel like a staged fantasy portrait shot against a backdrop, not a casual real-world environment.

POSE DIRECTION:
- seated on an invisible ledge, cloud, flower-shaped platform, or soft surreal surface
- crouching in midair or floating with bent knees
- side-seated pose with one leg folded and one extended
- one hand touching face, chin, lips, hair, or cigarette
- slightly slouched, dreamy, detached posture
- elegant but sensual body language, relaxed shoulders, elongated neck, soft wrist angles

FACIAL EXPRESSION:
Detached, dreamy, sultry, melancholic.
- half-lidded eyes, distant upward gaze, sleepy eyes
- mildly bored or emotionally unavailable look
- subtly parted lips, soft pout, seductive blankness
Avoid smiling widely. The face should feel cool, moody, glamorous, and slightly sinful.

MAKEUP:
- metallic or glittery silver-white eyeshadow
- high-shine wet-look highlighter on cheekbones, nose bridge, eyelids, and brow bone
- glossy lips or softly blurred lipstick
- slightly frosted ethereal makeup finish
- optional glitter tear detail, shimmer under the eyes, pearl-like highlights
Makeup should look editorial and flash-reactive.

HAIR:
Keep the uploaded person's actual hairstyle recognizable, refined for fantasy portrait.
Long straight or softly waved hair, center part, slightly messy seductive texture.
Do not fully replace the hairstyle. The person must still look like themselves.

WARDROBE:
Short fitted angelic-glam mini dress: white glitter mini, white satin slip, ivory bodycon, black micro dress for darker variation, or shiny black latex mini dress.
Minimal, feminine, short, leg-revealing silhouette — satin, shimmer knit, or glitter stretch fabric.

WINGS:
Large dramatic feathered angel wings, sculptural and visually dominant.
Pure white, off-white, slightly silver, or metallic champagne feathers.
Positioned behind the subject's back, framing the body.
Feathers visible and layered, theatrical costume feel — not flat stickers.

OPTIONAL HEAD DETAILS:
Small halo or tiny devil horns (optional). Keep it simple and iconic.

HAND PROP:
Subject holds a lit cigarette near lips or cheek, exhaling soft thin smoke wisps drifting upward gently.

SURROUNDING DECORATIVE ELEMENTS:
Floating around the subject: tiny porcelain cherubs/cupids, glossy red heart icons, little glowing stars, small embers, cloud puffs, smoke trails.
Arranged like a surreal digital collage orbiting the subject — intentionally kitschy, symbolic, slightly chaotic but stylish.
Cherubs: white porcelain statue style, smooth doll-like, surreal campy and decorative — NOT realistic anatomical babies.

BACKGROUND:
Surreal fantasy backdrop: stormy gray cloudscape, soft foggy celestial void, warm dark gradient sky, or dusty red-brown infernal cloud haze.
Flat enough to support the subject clearly, rich enough to feel immersive and themed.

COLOR PALETTE:
White, silver, gray, pearl, smoke — with red heart accents. Or ivory + charcoal + soft blood-red.
Controlled and editorial. Not rainbow-colored.

LIGHTING:
Strong direct frontal flash. Hard, immediate, camera-mounted flash feeling.
Bright facial highlights, crisp illuminated skin against darker background.
Visible reflective hotspots on glossy makeup and skin.

SUBJECT PRIORITY:
1. face  2. wings and pose  3. outfit  4. floating symbolic objects  5. background atmosphere

NEGATIVE RULES:
- do not change identity or generate a completely different face
- do not make it painterly or hyper-cinematic
- do not remove the raw flash aesthetic
- do not create a crowded multi-person composition
- do not let props block the face
- do not make the cherubs too realistic or grotesque
- do not make it comedic or childish
- do not flatten the wings into a cheap sticker look
- do not lose the dreamy smoke and cloud atmosphere

FINAL OUTPUT TARGET:
A highly stylized flash-shot fantasy portrait of the uploaded user as a glamorous fallen angel / dark cupid figure, with preserved identity, large feathered wings, glossy shimmer makeup, short angelic or dark mini dress, cigarette and smoke, surreal floating cherubs, red heart icons, tiny stars, and a moody cloud-filled celestial-underworld backdrop.`,
  },
  "orange-cosmic-girl": {
    "default": `Transform the uploaded photo into a Sailor Venus cosplay portrait set in a stylized amusement park.

This must look like a real high-resolution hybrid photograph — a physically real human subject captured in-camera, combined with a clearly artificial 2D illustrated background. Not fantasy illustration. Not fully rendered CGI. Not painterly. The subject must remain real.

FACE — PRESERVE IDENTITY, INTEGRATE NATURALLY:
- Preserve the uploaded user's exact facial identity: bone structure, eye shape, nose, lips, jawline, proportions, and instantly recognizable likeness
- Maintain the same expression and gaze direction unless minor adaptation is required for pose alignment
- CRITICAL: The face must feel naturally integrated into the body — same lighting direction, same contrast, same skin texture, same optical sharpness
- The face must NOT look pasted or composited unnaturally
- Match neck, jawline, skin tone, and perspective seamlessly
- No beautification that alters facial structure
- No plastic skin, no artificial symmetry correction
- Preserve pores, subtle skin variation, and natural detail
- The final result must adapt naturally regardless of gender while preserving identity

HAIR:
- Long, straight blonde wig styled in Sailor Venus fashion
- Red bow accessory on top
- Hair should retain realistic strand detail and natural light interaction
- No artificial or overly rigid hair rendering

OUTFIT:
- Sailor Venus cosplay costume:
  - White sleeveless top with deep orange collar
  - Navy-blue bow at the chest
  - Pleated orange skirt
  - Large yellow bow at the lower back
  - Orange and white elbow-length gloves
  - Orange glossy heels with ankle straps
- Materials must appear physically real: fabric texture, slight creasing, natural highlights
- No plastic or costume-like artificial rendering

POSE / COMPOSITION:
- Full-body, three-quarter view
- Dynamic, energetic pose
- Slightly angled stance with strong visual flow
- Subject centered and clearly separated from background
- Composition must feel like a real photographed cosplay shoot

BACKGROUND — 2D GRAPHIC PLATE (CRITICAL):
- Replace entire environment with a flat 2D illustrated amusement park scene
- Carousel, neon lights, signage, and decorative elements rendered as:
  - Vector-style shapes
  - Anime-style background art
  - Bold outlines and simplified geometry
- No photorealistic textures
- Clean color blocking with minimal gradients
- Optional cel-shading or halftone accents
- Background must feel intentionally flat and graphic, not semi-realistic
- Must NOT look like a blurred photograph — clearly a designed 2D plate

LIGHTING:
- Multi-colored neon lighting (blue, pink, yellow) originating from the 2D background
- Lighting on the subject must remain physically realistic
- Subtle colored light spill (rim light, edge tint) reflecting onto skin and outfit
- Maintain consistent light direction and believable interaction with the subject
- No illustrated lighting on the subject

DEPTH & SEPARATION:
- Strong separation between subject (3D real) and background (2D flat)
- Subject remains sharply rendered with natural depth
- Background remains flat; optional slight blur allowed but must retain graphic quality
- No depth simulation that makes the background appear realistic

PHOTO STYLE:
- High-resolution real digital photograph for the subject
- Background as a clean 2D composited plate
- Hybrid rendering: real human + flat illustration
- No painterly blending or texture merging
- No artificial composite artifacts

COLOR:
- Dominant palette must reflect neon blues, pinks, yellows, oranges
- Preserve and visibly reflect these core palette references:
  - #0c0f14
  - #375523
  - #11273c
  - #5b723b
  - #deb3a7
  - #6a565a
  - #08b5f0
  - #5670a0
  - #9e827b
  - #a4caf1
  - #294f7e
  - #f67f33
  - #e7eaf4
  - #7292d4
  - #a83d19
- Colors should be bold and graphic in the background while remaining natural on the subject

MOOD:
- Energetic
- Playful
- Anime-inspired
- Visually striking contrast between real human and artificial world
- Fashion-forward cosplay energy

STRICT RULES:
- The uploaded user's face must remain fully recognizable
- Subject must remain photorealistic
- Background must remain strictly 2D and graphic
- Do not blend the two styles into one
- Do not introduce realism into the background
- Do not stylize the subject into illustration
- Maintain clear hybrid contrast

OUTPUT TARGET:
- Ultra-realistic cosplay portrait with hybrid rendering
- Real human subject in Sailor Venus costume
- Flat 2D illustrated amusement park background
- Strong visual contrast between real and graphic elements
- Looks like a high-end composited editorial image, not AI-generated`,
    "flat-blue": `Transform the uploaded photo into a Sailor Venus cosplay portrait set against a flat color background.

This must look like a real high-resolution hybrid photograph — a physically real human subject captured in-camera, combined with a clearly artificial flat 2D background. Not fantasy illustration. Not fully rendered CGI. Not painterly. The subject must remain real.

FACE — PRESERVE IDENTITY, INTEGRATE NATURALLY:
- Preserve the uploaded user's exact facial identity: bone structure, eye shape, nose, lips, jawline, proportions, and instantly recognizable likeness
- Maintain the same expression and gaze direction unless minor adaptation is required for pose alignment
- CRITICAL: The face must feel naturally integrated into the body — same lighting direction, same contrast, same skin texture, same optical sharpness
- The face must NOT look pasted or composited unnaturally
- Match neck, jawline, skin tone, and perspective seamlessly
- No beautification that alters facial structure
- No plastic skin, no artificial symmetry correction
- Preserve pores, subtle skin variation, and natural detail
- The final result must adapt naturally regardless of gender while preserving identity

HAIR:
- Long, straight blonde wig styled in Sailor Venus fashion
- Red bow accessory on top
- Hair should retain realistic strand detail and natural light interaction
- No artificial or overly rigid hair rendering

OUTFIT:
- Sailor Venus cosplay costume:
  - White sleeveless top with deep orange collar
  - Navy-blue bow at the chest
  - Pleated orange skirt
  - Large yellow bow at the lower back
  - Orange and white elbow-length gloves
  - Orange glossy heels with ankle straps
- Materials must appear physically real: fabric texture, slight creasing, natural highlights
- No plastic or costume-like artificial rendering

POSE / COMPOSITION:
- Full-body, three-quarter view
- Dynamic, energetic pose
- Slightly angled stance with strong visual flow
- Subject centered and clearly separated from background
- Composition must feel like a real photographed cosplay shoot

BACKGROUND — FLAT COLOR (CRITICAL):
- Replace entire environment with a completely flat, solid color background
- No objects, no gradients, no textures, no patterns
- Pure single-tone color only
- Use a vivid anime-style sky blue:
  - #08b5f0 (primary solid fill)
- Background must feel clean, graphic, and minimal
- Must NOT include any environmental elements, lighting effects, or decorative shapes

LIGHTING:
- Neutral studio-like lighting on subject
- No environmental light influence from background
- Clean, even illumination with subtle natural shadows
- Maintain realistic skin rendering and material response

DEPTH & SEPARATION:
- Strong subject-background separation
- Subject remains fully photorealistic
- Background remains perfectly flat and depthless
- No blur, no depth simulation in background

PHOTO STYLE:
- High-resolution real digital photograph for the subject
- Background as a flat 2D color plate
- Hybrid rendering: real human + pure graphic background
- No painterly blending or texture merging
- No artificial composite artifacts

COLOR:
- Background locked to:
  - #08b5f0
- Preserve and visibly reflect these core palette references on subject and styling:
  - #0c0f14
  - #375523
  - #11273c
  - #5b723b
  - #deb3a7
  - #6a565a
  - #5670a0
  - #9e827b
  - #a4caf1
  - #294f7e
  - #f67f33
  - #e7eaf4
  - #7292d4
  - #a83d19

MOOD:
- Clean
- Graphic
- Playful
- Anime-inspired
- Strong visual contrast between real subject and flat color field

STRICT RULES:
- The uploaded user's face must remain fully recognizable
- Subject must remain photorealistic
- Background must be strictly a single flat color
- Do not add gradients, textures, or objects
- Do not stylize the subject into illustration
- Maintain clear separation between real subject and graphic background

OUTPUT TARGET:
- Ultra-realistic cosplay portrait
- Real human subject in Sailor Venus costume
- Pure flat sky-blue background (#08b5f0)
- Clean, minimal, high-contrast composition
- Looks like a high-end editorial photo with graphic backdrop, not AI-generated`,
  },
  "subway-cctv": {
    "default": `Use the uploaded image as the base and transform it, not generate a new person.

Transform the uploaded photo into a high-angle CCTV-style shot of a young Korean person standing inside a crowded subway car.

This must look like a real low-resolution surveillance capture — raw, compressed, distorted, and physically believable. Not stylized illustration. Not cinematic. Not CGI. Real.

FACE — PRESERVE IDENTITY, INTEGRATE NATURALLY:
- Replace the subject's face with the uploaded user's face while preserving exact identity: face shape, bone structure, eye shape, nose, lips, jawline, proportions, and instantly recognizable likeness
- Maintain a neutral, candid expression unless minimal adjustment is required
- CRITICAL: The face must feel naturally integrated into the surveillance environment — same lighting direction, same compression artifacts, same motion softness, same color degradation, and same overall image sharpness
- The face must NOT look clean, enhanced, or artificially sharp
- The face must be partially affected by motion blur, compression noise, and angle distortion
- Match head position and perspective from a ceiling-mounted camera viewpoint
- Preserve identity under degraded image conditions
- No beautification, no smoothing, no symmetry correction
- The final result must adapt naturally regardless of gender while preserving the same recognizable identity

FACE & CAMERA:
- Keep the subject recognizable but degraded by CCTV quality
- Maintain believable proportions under fisheye distortion
- The face must NOT be the sharpest element in the image
- Capture as if from a ceiling-mounted security camera
- Lens: ultra-wide fisheye (approx. 12–16mm equivalent)
- Aperture: fixed small sensor aperture equivalent (deep focus)
- Shutter speed: low (~1/30–1/60 sec) to allow motion blur
- ISO: high (800–1600 equivalent) to introduce noise
- White balance: cool fluorescent (approx. 4200K–4800K)
- Dynamic range: limited, with compressed highlights and shadows
- Heavy digital compression and low bitrate artifacts must be visible

HAIR:
- Preserve the uploaded user's hairstyle
- Hair must appear slightly blurred and compressed due to motion and low resolution
- No stylization

CLOTHING:
- The outfit must adapt automatically to the uploaded user's gender presentation while preserving the same everyday CCTV-subway realism
- If the uploaded user reads as male, use a heavy cotton jacket and slacks
- If the uploaded user reads as female, replace the outfit with realistic everyday women's streetwear appropriate for a subway commute, while keeping the same understated, practical, non-stylized mood
- Fabrics must appear slightly flattened and texture-reduced due to compression
- No stylization or fashion-forward exaggeration
- No wardrobe that feels staged, glamorous, or costume-like

POSE / COMPOSITION:
- High-angle shot from ceiling
- Subject positioned among other passengers
- Slightly off-center framing due to surveillance placement
- Natural standing posture
- Crowd partially visible, some figures cropped or cut off
- Composition must feel incidental, not composed

PROP:
- Subway interior elements:
  - metal poles
  - overhead handrails
  - brushed steel walls
  - tiled or reflective floor
- Passengers around subject, partially blurred or obscured
- No staged props

SCENE:
- Interior subway car
- Crowded environment
- Metallic surfaces and linear structure
- Tube-like perspective with vanishing lines
- Environment must feel busy and functional
- No stylization or cleanup

LIGHTING:
- Overhead LED strip lighting
- Harsh, cool fluorescent illumination
- Specular highlights on metal surfaces
- Uneven lighting distribution across frame
- Slight flicker or exposure inconsistency
- No soft lighting, no cinematic lighting

DEPTH & OPTICS:
- Fisheye distortion across the frame
- Strong edge warping
- Deep focus across entire image
- No bokeh
- Slight perspective compression due to lens and angle
- No clean optical rendering

PHOTO STYLE:
- Low-resolution CCTV footage aesthetic
- Visible compression artifacts (blockiness, macroblocking)
- Motion blur on moving subjects
- Grainy digital noise
- Slight frame softness
- No HDR
- No sharpening
- No editorial polish
- Must feel like raw surveillance footage

REAL CAMERA IMPERFECTIONS (CRITICAL):
- Compression artifacts across entire image
- Motion blur in moving subjects and edges
- Chroma noise in darker areas
- Banding in gradients
- Slight frame tearing or uneven detail
- Uneven sharpness across frame
- No clean lines or edges

EXPOSURE & RESPONSE:
- Slight underexposure overall
- Highlights from lights slightly blown
- Shadows slightly crushed
- Midtones compressed
- No balanced exposure
- No tonal refinement

ANTI-AI CONSTRAINT:
- Do NOT produce clean or sharp image
- Do NOT enhance face clarity
- Do NOT remove distortion or noise
- Do NOT center composition perfectly
- Do NOT stylize lighting
- Maintain degraded surveillance realism

COLOR:
- Dominant palette:
  - gray
  - metallic blue
  - fluorescent white
- Cool color cast across entire frame
- Slight desaturation
- No color grading

MOOD:
- Candid
- Immediate
- Slightly chaotic
- Everyday realism
- Observational
- Slightly mischievous

STRICT RULES:
- Must use the uploaded image identity as the base
- Must not generate a new face
- Preserve CCTV angle and distortion
- Maintain crowd presence and partial occlusion
- Keep low-resolution degraded quality
- Maintain subway environment
- Keep outfit gender-adaptive automatically based on the uploaded user while preserving realistic commuter styling
- Do not stylize or clean image
- Keep everything physically believable

OUTPUT TARGET:
- Ultra-realistic CCTV-style subway image
- Same recognizable person in crowd
- High-angle fisheye distortion
- Low resolution with compression artifacts and motion blur
- Harsh fluorescent lighting
- Gender-adaptive everyday commuter outfit based on the uploaded user
- Looks like real surveillance footage, not AI-generated`,
  },
  "visual-kei": {
    "default": `Use the uploaded image as the base and transform it, not generate a new person.

Transform the uploaded photo into a straight-on portrait shot of a single South Korean visual kei musician against a minimalist industrial backdrop.

This must look like a real high-resolution editorial band photograph — edgy, decadent, somber, and physically believable. Not fantasy art. Not stylized illustration. Not CGI. Real.

FACE — PRESERVE IDENTITY, INTEGRATE NATURALLY:
- Apply the uploaded user's face to the single subject while preserving exact identity: face shape, bone structure, eye shape, nose, lips, jawline, proportions, and instantly recognizable likeness
- Replace the subject's face with the uploaded user's face while preserving exact identity: face shape, bone structure, eye shape, nose, lips, jawline, proportions, and instantly recognizable likeness
- Maintain the same cool, casual, slightly provocative expression unless minimal adjustment is required
- CRITICAL: The replaced face must feel naturally integrated into the portrait — same lighting direction, same contrast, same skin texture, same makeup finish, and same overall image sharpness as the rest of the photograph
- The face must NOT look pasted, over-cleaned, or artificially beautified
- Match head position, neck, posture, and perspective seamlessly into the subject
- Preserve real skin texture and facial structure beneath the makeup
- No structural beautification, no plastic skin, no artificial symmetry correction
- The final result must adapt naturally regardless of gender while preserving the same recognizable identity

FACE & CAMERA:
- Keep the subject instantly recognizable as the original user
- Maintain believable face proportions and natural structure
- The replaced face must feel like a real photographed visual kei musician under dim studio lighting, not composited
- Capture using a professional full-frame digital camera system
- Lens: 50mm standard prime
- Aperture: f/4–f/5
- Shutter speed: ~1/125 sec
- ISO: 800–1600
- White balance: cool-neutral, approx. 4000K–4800K
- Dynamic range: preserve shadow depth while retaining metallic reflections and fabric detail
- No excessive sharpening; retain slight low-light softness and subtle digital noise

HAIR:
- Voluminous, spiked, and color-treated visual kei hairstyle
- Electric red, platinum blonde, or jet black hair tones with possible visible streaks or extensions
- Hair must feel heavily styled but physically real
- No plastic or CGI hair rendering

CLOTHING:
- Studded leather jacket
- Band T-shirt
- Silver chains
- Layered accessories
- Fingerless gloves made from heavy opaque black leather or thick cotton
- Clothing must feel real, textured, weighty, and performance-oriented
- No fantasy-costume exaggeration

POSE / COMPOSITION:
- Straight-on portrait shot
- Single subject only
- Casual but slightly provocative pose
- Tight framing emphasizing visual kei styling and personality
- Balanced composition with the subject clearly isolated
- Minimalist industrial backdrop remains secondary to the subject

PROP / ACCESSORIES:
- Metal jewelry
- Chains
- Fingerless gloves
- Layered rock accessories
- Faint fog visible in the scene
- Accessories must reflect light naturally and remain physically believable

SCENE:
- Minimalist industrial backdrop
- Dim, moody environment
- Slightly rough, understated background texture
- Faint visible fog in the air
- Environment must support the band aesthetic without distracting from the subject

LIGHTING:
- Intentionally dim lighting
- Single soft box positioned overhead
- Deep moody shadows
- Cool blue-tinted specular highlights
- Controlled reflections on leather, skin, and metal jewelry
- Lighting must feel studio-based but low-key and atmospheric
- No bright beauty lighting
- No cinematic over-lighting

DEPTH & OPTICS:
- Standard lens perspective
- Moderate depth of field keeping the subject readable
- Crisp focus across face, fabrics, and jewelry
- Slight vignette toward frame edges
- No visible distortion
- Natural optical rendering with subtle low-light softness

PHOTO STYLE:
- High-resolution digital editorial photography
- Crisp fabric texture
- Clear skin detail
- Sharp jewelry reflections
- Subtle digital noise from low-light conditions
- No HDR exaggeration
- No painterly softness
- No AI-smooth rendering
- Must feel like a real photographed visual kei portrait

REAL CAMERA IMPERFECTIONS (CONTROLLED):
- Slight low-light digital noise
- Subtle vignette
- Mild highlight bloom on reflective jewelry and leather
- Slight shadow grain in darker regions
- No perfectly sterile gradients
- No unnaturally clean low-light rendering

EXPOSURE & RESPONSE:
- Exposure biased to preserve mood and shadow depth
- Highlights on metal and leather must roll off naturally
- Blacks must remain deep but not flatly crushed
- Midtones must preserve makeup, skin texture, and clothing detail
- No flat global exposure balance

ANTI-AI CONSTRAINT:
- Do NOT add extra band members
- Do NOT make the subject look duplicated
- Do NOT over-clean skin or makeup
- Do NOT simplify accessories or styling
- Do NOT flatten the overhead lighting
- Maintain low-light realism, texture, and individuality

COLOR:
- Dominant palette:
  - muted silver
  - deep black
  - accent jewel tones
- Hair colors include electric red, platinum blonde, or jet black
- Cool blue-tinted highlights from lighting
- Palette must remain dark, metallic, and moody
- No oversaturation
- No warm color shift

MOOD:
- Edgy
- Decadent
- Somber
- Glam-rock
- Slightly provocative
- Atmospheric and cool

STRICT RULES:
- Must use the uploaded image identity as the base
- Must not generate a new face
- Only one person must appear in the final image
- Preserve visual kei makeup, hair, clothing, accessories, fog, and industrial backdrop
- Maintain dim overhead softbox lighting and moody shadow structure
- Keep everything physically believable

OUTPUT TARGET:
- Ultra-realistic visual kei portrait
- Single South Korean visual kei musician
- Same recognizable user identity
- Gothic makeup, flamboyant rock styling, fog, and industrial backdrop
- Dark metallic palette with cool highlights
- Looks like a real photographed band editorial portrait, not AI-generated`,
  },
  "crimson-glass-rose": {
    "default": `Use the uploaded image as the base and transform it, not generate a new person.

Transform the uploaded photo into an intimate close-up portrait of a young Korean woman whose face is framed inside a large translucent glass rose, matching the exact tone, mood, lighting behavior, color wash, softness, reflective detail, and luxurious surreal editorial finish of the attached reference image.

This must look like a real high-resolution editorial portrait photograph with a surreal-but-photographic romantic atmosphere - intimate, moody, luminous, dreamy, glassy, and physically believable within the image world. Not fantasy art. Not stylized illustration. Not CGI. Real.

FACE - PRESERVE IDENTITY, INTEGRATE NATURALLY:
- Replace the subject's face with the uploaded user's face while preserving exact identity: face shape, bone structure, eye shape, nose, lips, jawline, proportions, and instantly recognizable likeness
- Maintain a neutral, mysterious, calm, direct-to-camera expression unless minimal adjustment is required
- CRITICAL: The face must feel naturally integrated into the glass-rose portrait environment - same lighting direction, same contrast, same skin texture, same translucent reflection behavior, same red-pink glow contamination, and same overall image sharpness as the rest of the photograph
- The face must NOT look pasted, over-cleaned, or artificially beautified
- Match head position, neck, posture, skin tone, and perspective seamlessly into the close-up composition
- Preserve real skin texture, pores, subtle asymmetry, and natural facial structure
- No structural beautification, no plastic skin, no artificial symmetry correction
- The final result must adapt naturally regardless of gender while preserving the same recognizable identity and the intended surreal romantic portrait context
- The face must remain softly luminous, finely detailed, and intimate rather than hard-edged or overly contrasty
- Facial rendering must inherit the same creamy glow, moist highlight behavior, and soft dreamlike polish visible in the attached reference

FACE & CAMERA:
- Keep the subject instantly recognizable as the original user
- Maintain believable face proportions and natural structure
- The face must feel like a real photographed subject inside a physical surreal set, not a composited fantasy face
- Capture using a professional full-frame digital camera system
- Lens: 85mm portrait lens
- Aperture: f/1.8-f/2.2 to create shallow depth of field and soft luxury separation
- Shutter speed: approximately 1/125 to 1/200 sec
- ISO: 100 to 400
- White balance: warm-magenta-neutral balance around 4200K to 5000K with strong red/crimson light contamination
- Dynamic range: preserve glass highlights, lip sheen, skin detail, and deep rosy shadows without clipping
- No digital over-sharpening; maintain natural lens softness, shallow-focus falloff, smooth highlight roll-off, and refined editorial polish
- Optical rendering must match the attached reference: close, intimate, expensive, soft yet detailed, and clearly shot through a premium portrait lens with luxurious shallow depth

HAIR:
- Preserve the uploaded user's natural hairstyle
- Hair must remain mostly secondary to the face and glass-rose framing
- Any visible hair must read dark, soft, and naturally integrated into the warm red-pink environment
- No unrelated hairstyle redesign
- No excessive volume or fashion-hair exaggeration
- Hair must remain elegant and subdued, as in the attached reference

CLOTHING / BODY PRESENTATION:
- Only the face and upper body / shoulders need to be visible
- Clothing, if visible at all, must remain minimal, secondary, and visually unobtrusive
- The composition must prioritize face, skin, glass rose, and crystal floral elements over wardrobe
- No distracting garment details
- No text, logos, or brands
- No revealing emphasis beyond what is naturally implied by a close beauty/editorial framing
- Body rendering must remain tasteful, elegant, and non-explicit

POSE / COMPOSITION:
- Tight close-up portrait
- Straight-on framing with the face centered as the main focal point
- The face and upper body occupy most of the frame
- Subject gazes directly into the lens
- The translucent glass rose wraps around and frames the face prominently
- Floating crystal-like flower petals appear beside the cheek
- The framing must closely follow the attached reference:
  - face fills the frame generously
  - glass rose petals dominate the foreground framing
  - one or more crystal floral forms float near the cheek/jaw area
  - composition feels intimate, enclosed, and sculptural
- Do not widen the frame
- Do not move the subject too far back
- Keep the portrait scale close, luxurious, and emotionally immediate

PROP / ENVIRONMENTAL ELEMENTS:
- Large translucent glass rose framing the face
- Glass rose must feel thick, sculptural, curved, and physically real
- Several crystal-like flower petals or floral elements floating near the cheek
- Glass and crystal elements must remain transparent to semi-transparent with realistic refraction, reflection, and internal glow
- The translucent rose must distort and catch light naturally
- No plastic appearance
- No cheap acrylic look
- No repeated or symmetrical decorative copy-paste forms
- Glass surfaces must feel premium, artistic, and tactile as in the attached reference

SCENE:
- Minimal surreal beauty/editorial set
- No visible text or brands
- Softly colored blurred backdrop
- Background must remain secondary, velvety, and atmospheric
- Environment must feel intimate, enclosed, and art-directed rather than environmental or architectural
- The entire scene must revolve around face, glass rose, floating crystal floral elements, and luminous color atmosphere
- The image must feel like a luxury beauty-fashion still, not a narrative location shot

LIGHTING:
- Deep red prism-like light washing over the scene
- Romantic crimson and blush-toned glow dominating the full composition
- Slight violet undertone in select shadows and reflections
- Light must feel soft, enveloping, and luxurious rather than harsh
- Strong colored light contamination across skin, glass, and background
- Glass rose edges must catch bright pink-red highlights and soft reflective rims
- Skin must glow gently with moist, soft specular highlights
- No hard spotlight
- No flat beauty-light symmetry
- Lighting must match the attached reference exactly in feeling:
  - warm crimson-magenta wash
  - luminous skin highlights
  - glowing translucent glass edges
  - moody but rich shadows
  - velvety, romantic, surreal color atmosphere
- The scene must feel expensive, intimate, and softly lit from multiple blended colored sources rather than plainly front-lit

DEPTH & OPTICS:
- 85mm lens compression
- Very shallow depth of field
- Face remains sharply readable
- Background falls into creamy soft blur
- Glass rose edges and floating crystal flowers may drift in and out of the focus plane naturally
- No wide-angle distortion
- Optical rendering must feel lens-based, intimate, and real
- Depth behavior must match the attached reference:
  - closest glass edges may soften slightly
  - facial center remains the visual anchor
  - background dissolves into warm blur
  - crystal elements remain readable but softly integrated

PHOTO STYLE:
- High-resolution digital portrait photography
- Luxury beauty/editorial finish
- Soft dreamlike polish with high detail preserved in skin, lips, and glass highlights
- Moist luminous lip texture
- Smooth shallow-focus rendering
- Rich but controlled color wash
- No film grain
- No visible digital noise
- No HDR exaggeration
- No painterly brush texture
- No AI-smooth rendering
- Must feel like a real photographed surreal beauty portrait, not a digitally painted fantasy image
- Must match the attached reference in finish:
  - glossy but soft
  - intimate but surreal
  - luminous but controlled
  - high-resolution yet dreamlike
  - editorial and art-directed without looking synthetic

REAL CAMERA IMPERFECTIONS (CONTROLLED):
- Slight highlight bloom along the brightest glass edges
- Mild contrast falloff through translucent glass surfaces
- Slight internal reflection complexity within the glass rose and crystal petals
- Very subtle depth softness at the extreme near foreground glass edges
- No perfectly sterile gradient transitions in the background glow
- No unnaturally cut-out subject edges
- No artificial subject separation from the glass structure
- Maintain natural optical softness and reflective complexity matching the reference

EXPOSURE & RESPONSE:
- Exposure balanced for skin clarity, glass highlights, and luminous lip texture
- Highlights must roll off softly on the glass rose and cheekbone areas
- Shadows must remain rich, moody, and colored, not crushed
- Midtones must preserve facial structure, lip texture, and translucent glass detail
- Crimson/blush atmospheric wash must remain controlled and integrated into the light
- No flat global exposure balance
- Exposure must feel rich, close, and editorial, with the face floating inside a warm glass-lit atmosphere
- Contrast must remain soft-luxurious rather than aggressive

ANTI-AI CONSTRAINT:
- Do NOT turn the glass rose into fantasy CGI plastic
- Do NOT over-beautify the face
- Do NOT over-clean the skin into cosmetic perfection
- Do NOT flatten the reflections or simplify the glass optics
- Do NOT stylize into illustration or beauty-ad CGI
- Do NOT introduce extra decorative elements beyond the glass rose and crystal floral forms
- Do NOT make the composition wider, cleaner, or more minimal than the attached reference
- Maintain real photographic rendering with surreal subject matter only
- Follow the attached reference's intimate framing, crimson mood, glass realism, and dreamy luxury finish exactly

COLOR:
- Dominant palette:
  - deep crimson
  - blush pink
  - warm rose-red
  - barely-there violet
- Secondary tones:
  - soft natural skin tone
  - translucent pink-glass highlights
  - rosy shadow gradients
- The scene must remain deeply saturated in red-pink atmosphere without becoming neon
- No harsh color separation
- No artificial grading spikes
- Color must match the attached reference closely:
  - rich magenta-red wash
  - warm blush skin glow
  - soft violet traces in shadow or glass edge
  - luminous pink glass reflections
  - intimate romantic color atmosphere

MOOD:
- Mysterious
- Romantic
- Dreamlike
- Sophisticated
- Intimate
- Moody
- Surreal
- Quietly luxurious
- Ethereal yet grounded
- Must match the emotional tone of the attached reference exactly

STRICT RULES:
- Must use the uploaded image identity as the base
- Must not generate a new face
- Preserve the close-up composition, direct gaze, glass rose framing, floating crystal-like floral elements, deep crimson light, 85mm shallow depth of field, moist glossy lips, and soft blurred background
- The attached reference image's tone, mood, redness, lighting behavior, optical softness, reflective complexity, framing intimacy, and editorial finish must be followed as closely as possible
- Do not stylize into fantasy art or glossy CGI beauty illustration
- Keep all elements grounded in a real photographed image with surreal subject matter
- The uploaded face identity must remain unchanged and clearly preserved

OUTPUT TARGET:
- Ultra-realistic surreal beauty portrait
- Same recognizable person framed inside a large translucent glass rose
- Floating crystal-like flowers near the cheek
- Deep crimson, blush, and faint violet color atmosphere
- Moist glossy lips, shallow 85mm depth, and soft luxury blur
- Exact attached-reference feeling: intimate, romantic, glassy, moody, luminous, and luxurious
- Looks like a real photographed surreal editorial image, not AI-generated`,
  },
  "gyaru": {
    "default": "Transform this photo into an authentic early-2000s Japanese gyaru (ギャル) portrait style. Keep the person's identity intact — same face structure, same person.\n\nMAKEUP TRANSFORMATION:\n- Heavy dramatic eye makeup: thick layered false lashes, strong black eyeliner with extended outer corners\n- Dark dramatic contact lens effect (high contrast, enlarged-looking)\n- White shimmer highlight under the eyes (tear bag / aegyo-sal emphasis)\n- Bright vertical nose highlight stripe\n- Pale matte skin base with soft airbrushed finish\n- Pink blush across cheeks and nose bridge\n- Glossy light pink overlined lips\n\nHAIR:\n- Dye to blonde or light brown\n- Voluminous, curled, layered gyaru styling\n- Shiny, slightly synthetic-looking texture\n\nOUTFIT & BACKGROUND:\n- Leopard or animal print elements in outfit or background\n- Sparkly, rhinestone-style accessories\n- Feminine, over-the-top Y2K gyaru fashion\n\nPHOTO STYLE:\n- Front-facing selfie angle, slightly top-down\n- Direct flash lighting: overexposed skin highlights, high contrast\n- Warm candy-like color tone\n- Retro Japanese photo booth (purikura) aesthetic: slight grain, warm saturation\n\nSTRICT RULES:\n- Preserve the person's identity: same face, same bone structure\n- No face reshaping or identity change\n- Output must look like a real early-2000s gyaru photo",
  },
  "idol-photocard": {
    "default": `${STRICT_IDENTITY_LOCK}

${SELFIE_REALISM_LOCK}

Transform the uploaded photo into a polished K-pop photocard style portrait.

LOOK:
- Clear radiant skin with glossy realistic highlights
- Soft pink blush, subtle shimmer under the eyes, glossy gradient lips
- Clean sparkling idol makeup, fresh and youthful
- Hair should stay recognizable but more polished, silky, and camera-ready

WARDROBE & STYLING:
- Trendy feminine idol styling: soft knit top, fitted cardigan, ribbon detail, or clean stage-casual look
- Delicate accessories such as a tiny hair clip, ribbon, or stud earrings

COMPOSITION:
- Chest-up or close portrait framing
- Subject centered like a collectible photocard
- Slightly cute, camera-aware expression, gentle smile or soft neutral

BACKGROUND:
- Clean pastel or softly blurred studio background
- Light bokeh, airy glow, polished entertainment-company photocard mood

PHOTO STYLE:
- High-resolution beauty portrait
- Bright but soft frontal lighting
- Subtle skin texture retained
- Premium photocard finish, not plastic or uncanny

STRICT RULES:
- Do not change the person into a different idol face
- Do not exaggerate eye enlargement too much
- Keep the result believable, polished, and instantly recognizable`
  },
  "club-flash": {
    "default": `IDENTITY LOCK — NON-NEGOTIABLE:
- Preserve the exact same person from the uploaded photo
- Keep the same face shape, bone structure, eye shape, nose, lips, jawline, skin texture, and recognizable identity
- Keep skin tone family and ethnicity consistent
- Do not replace the subject with a generic party model
- Do not feminize or masculinize the face unnaturally
- Adapt styling, grooming, outfit details, and makeup intensity naturally to the uploaded person, whether male or female
- If any style instruction conflicts with identity preservation, preserve identity first

FACE & CAMERA:
- Keep the subject instantly recognizable as the original user
- Preserve believable face proportions, hairline, and facial volume
- Maintain a natural candid nightlife-photo feel, not an over-generated beauty-editorial face
- Do not over-smooth the face or erase unique facial details
- Keep pores, slight under-eye texture, natural skin sheen, and real facial dimension
- The subject should NOT be staring directly into the camera
- Use an off-guard moment: looking slightly to the side, glancing downward, mid-conversation, laughing, turning the head, or reacting to someone nearby
- Expression should feel spontaneous, socially alive, and unposed

NIGHTLIFE REALISM LOCK:
- Transform the uploaded photo into an ultra-natural nightlife flash portrait captured in a real club, lounge, bar, or party environment
- The realism must come from believable lighting, candid body language, natural expression, imperfect framing, and authentic environmental detail
- The image should feel like a real premium digital-camera or phone-flash party photo someone captured in the middle of the night
- Avoid fashion-campaign artificiality, fantasy glamour, surreal effects, cartoon stylization, or AI-looking symmetry
- Keep the subject as the only clear main identity focus
- Any surrounding people must remain soft, partial, cropped, or out of focus

LOOK:
- Strong direct on-camera flash hitting the subject at close range
- Bright flash exposure on the face and upper body, while the background falls into darker ambient tones
- Natural glossy skin highlights from flash, slight warmth, realistic late-night skin sheen, subtle sweat or humidity glow
- Styling should suit the uploaded subject naturally:
  - for women: optional glossy lips, subtle shimmer lids, softly smudged nightlife makeup, realistic party-ready skin
  - for men: natural skin sheen, light under-eye depth, subtle flash highlights, optional slightly tousled hair or lived-in grooming
- No excessive contouring, no drag-like makeup exaggeration, no plastic skin, no editorial over-retouching

SCENE:
- Dark nightclub, lounge, underground bar, or private party setting
- Out-of-focus neon accents, practical club lights, reflective metal or glass surfaces, dim interior depth
- Hints of people, drink glasses, chrome details, LED strips, speaker lights, mirror reflections, or bottle service atmosphere in the background
- Background should feel crowded, alive, and late-night, but never distract from the subject
- Light haze, ambient darkness, and localized color spill are allowed if realistic
- No stage performance feel, no red-carpet backdrop, no studio setup

COMPOSITION:
- Candid shoulder-up or waist-up party portrait
- Slightly imperfect documentary framing, as if shot quickly by a friend in the moment
- Subject remains sharp under flash
- Background may show slight motion blur, low-light drag, or soft ghosting from movement
- Camera angle can be slightly tilted, close, intimate, and casual
- The subject may be seated in a booth, leaning near a table, standing near friends, turning away from the lens, or caught mid-reaction
- Do not force a centered portrait pose
- Do not force direct eye contact

LIGHTING:
- Primary light source is a harsh but realistic direct camera flash
- Secondary ambient light comes from club practicals: magenta, cyan, warm amber, deep red, violet, or cool white accents
- Keep flash realism: bright foreground skin, shiny catchlights, crisp facial detail, darker depth behind
- Do not over-darken the face
- Do not let colored ambient lighting overpower recognition
- Preserve true facial readability under the flash

MOOD:
- Fun, cool, social, messy in a believable way, high-energy but intimate
- Feels like a real after-midnight memory
- Slightly chaotic, slightly glamorous, accidentally iconic
- The charm should come from how real and in-the-moment it feels, not from exaggeration

STRICT RULES:
- Keep the exact person recognizable at first glance
- Do not change age, ethnicity, or core facial anatomy
- Do not turn the result into a stylized fashion editorial
- Do not make the subject pose like a model unless the original face naturally suits that moment
- Do not over-process skin or sharpen details unnaturally
- Do not make the lighting too clean, balanced, or studio-like
- Preserve realism under direct flash above all else

OUTPUT TARGET:
- Ultra-realistic candid nightlife flash portrait
- Same person, real club energy, natural off-guard expression
- Looks like a genuine premium party snapshot taken by a friend at the perfect accidental moment`
  },
  "red-carpet-glam": {
    "default": `${STRICT_IDENTITY_LOCK}

${SELFIE_REALISM_LOCK}

Transform the uploaded photo into a red-carpet editorial glamour portrait.

STYLING:
- Luxury event makeup: sculpted but natural, glowing skin, defined eyes, glossy nude lips
- Elegant hair styling, polished and camera-ready
- Black, white, champagne, or jewel-tone gown styling

SCENE:
- Red carpet or step-and-repeat event entrance
- Paparazzi flash ambience, premium event backdrop, cinematic luxury mood

COMPOSITION:
- Half-body or three-quarter portrait
- Confident pose, celebrity energy, poised posture

PHOTO STYLE:
- High-end event photography
- Strong flash bursts and polished skin sheen
- Premium editorial finish

STRICT RULES:
- Keep the person instantly recognizable
- Avoid turning the face into a generic celebrity
- Make it aspirational, elegant, and believable`
  },
  "dark-coquette": {
    "default": `${STRICT_IDENTITY_LOCK}

${SELFIE_REALISM_LOCK}

Transform the uploaded photo into a dark coquette portrait.

LOOK:
- Black lace, ribbon choker, cherry-red lip accents, soft smoky eye
- Feminine but moody styling
- Porcelain-inspired glow without erasing real identity

HAIR:
- Same hairstyle preserved but styled with darker, shinier, moodier finish

OUTFIT:
- Black lace top, velvet ribbon details, fitted romantic silhouette

BACKGROUND:
- Dim bedroom, vintage vanity, candlelit mirror corner, or moody editorial set
- Deep burgundy, black, espresso, and dark cherry tones

MOOD:
- Romantic, slightly melancholic, stylish, internet-trend coded

PHOTO STYLE:
- Flash plus shadowy ambient light
- Intimate, editorial, dramatic but still social-app-friendly

STRICT RULES:
- Do not turn this into gothic horror
- Do not over-age the subject
- Keep it pretty, moody, and wearable`
  },
  "datecam-film": {
    "default": `${STRICT_IDENTITY_LOCK}

${SELFIE_REALISM_LOCK}

Transform the uploaded photo into a nostalgic date-cam film snapshot.

SCENE:
- Warm candid evening outing
- Restaurant window, city sidewalk, convenience store, or casual date-night environment
- The image should feel spontaneous and emotionally real

PHOTO STYLE:
- Compact camera flash
- Slight blur or softness from motion
- Fine film grain and timestamp-camera mood
- Warm skin tones with imperfect but charming exposure

MOOD:
- Cute, intimate, casual, lived-in, very save-to-camera-roll energy

COMPOSITION:
- Candid framing, not overly posed
- The subject remains the clear focus and recognizable

STRICT RULES:
- Do not make the blur so strong that the face changes
- Do not make it too dark or muddy
- Keep the emotional warmth and authenticity`
  },
  "ulzzang-cam": {
    "default": `${STRICT_IDENTITY_LOCK}

${SELFIE_REALISM_LOCK}

Transform the uploaded photo into a nostalgic ulzzang-cam selfie revival.

LOOK:
- Bright under-eye emphasis, softly enlarged-looking eyes without changing identity
- Blur-filter softness, glossy gradient lips, pink blush, cute clean makeup
- Fresh 2010s Korean internet beauty mood

HAIR & STYLING:
- Keep hairstyle recognizable
- Add girly styling details like soft clips, polished bangs, or neat framing strands

PHOTO STYLE:
- Front-facing webcam or phone-cam selfie feel
- Slight beauty blur, bright exposure, cute digital softness
- Charming, slightly artificial, intentionally nostalgic internet-camera aesthetic

MOOD:
- Pretty, playful, cute, nostalgic, instantly saveable

STRICT RULES:
- Do not distort the face proportions too much
- Do not turn it into a cartoon filter
- Keep the user recognizable and flattering`
  },
  "jjimjilbang-master": {
    "default": `${STRICT_IDENTITY_LOCK}

${SELFIE_REALISM_LOCK}

${HUMOR_REALISM_LOCK}

Transform the uploaded photo into a classic Korean jjimjilbang candid photo.

SCENE:
- Warm indoor Korean sauna lounge or resting hall
- Yellow-brown heated floor mats, wooden walls, casual lounge area
- The subject wears a jjimjilbang outfit and the iconic sheep-head towel
- Holding two baked eggs and a cup of sikhye

MOOD:
- Slightly over-serious expression inside an obviously mundane, funny situation
- Feels like a real phone photo taken by a friend

PHOTO STYLE:
- Flat indoor lighting, slight phone-camera noise, realistic candid framing
- Slightly dim indoor light, no glamorization, believable face preservation`
  },
  "skydiving": {
    "default": `${STRICT_IDENTITY_LOCK}

${SELFIE_REALISM_LOCK}

${HUMOR_REALISM_LOCK}

Transform the uploaded photo into a tandem skydiving snapshot high above a coastal city.

SCENE:
- Mid-air freefall during a real tandem skydive
- Bright blue sky, scattered white clouds, distant coastline and city grid far below
- Subject strapped into visible skydiving harness gear
- Wide action-camera perspective, arms spread or expressive midair pose
- Wind-blown clothing and hair, intense daylight, natural airborne energy

MOOD:
- Adrenaline-filled, spontaneous, thrilling, slightly chaotic in a funny and iconic real-life way

PHOTO STYLE:
- GoPro-style extreme sports documentary photo, wide-angle perspective, sharp daylight realism, natural motion and altitude atmosphere`
  },
  "maid-cafe-heart": {
    "default": `IDENTITY LOCK — NON-NEGOTIABLE:
- Preserve the exact same person from the uploaded photo
- Keep the same face shape, bone structure, eye shape, nose, lips, jawline, and recognizable identity
- Keep skin tone family and ethnicity consistent
- Do not replace the subject with a generic model
- If any style instruction conflicts with identity preservation, preserve identity first

FACE & CAMERA:
- Keep the subject instantly recognizable as the original user
- Preserve believable face proportions and hairline
- Maintain a natural candid portrait feel, not an over-generated fantasy face
- Do not over-smooth the face or erase unique facial details

REAL-WORLD HUMOR LOCK:
- The image should feel charming because of the outfit, pose, expression, and real-life setting, not because the face is distorted
- Keep the subject as the same recognizable person
- Make it feel like a real themed café or cosplay maid café snapshot someone casually took
- Avoid cartoonish exaggeration, meme text, stickers, or surreal effects
- One person only, clear focus, believable indoor lifestyle setting
- The styling should work naturally for any uploaded subject, regardless of gender, by adapting the costume and presentation in a flattering, believable, café-themed way rather than forcing a gendered look

Transform the uploaded photo into a themed Japanese maid café snapshot.

SCENE:
- Soft pastel café interior with bright window light, warm wooden tables, light curtains, and a cute service-counter atmosphere
- Subject wearing a polished maid café uniform or café-themed costume adapted naturally to suit the person in the uploaded photo
- Decorative accessories such as ribbon, lace, wrist frills, or themed name tag may be included if they fit naturally
- Subject poses toward the camera with a sweet hand-heart or welcoming service gesture
- Background may include softly blurred staff or customers in similar themed café attire for realism, but the uploaded subject remains the only clear focus

MOOD:
- Cute, cheerful, slightly performative, warmly staged, the kind of themed café photo that feels earnest and unintentionally iconic

PHOTO STYLE:
- Soft daylight café snapshot, gentle bloom in highlights, bright pastel realism, natural candid framing, authentic themed-culture photo atmosphere`
  },
  "hiphop-grillz": {
    "default": `Transform this photo into a luxury hip-hop close-up portrait.

This must look like a real high-resolution editorial-style close-up photograph captured in a dark studio or backstage environment — completely unretouched, raw, grounded, and authentic. Not poster art. Not stylized fantasy. Real.

FACE — PRESERVE IDENTITY, INTEGRATE NATURALLY:
- Preserve the person's exact facial features: bone structure, eye shape, nose, lips, jawline, proportions, and instantly recognizable identity
- Keep the same expression and gaze direction unless the source image naturally requires a slight adjustment for composition
- CRITICAL: The face must feel naturally integrated into the scene — same lighting direction, same contrast, same skin texture, same highlight behavior, and same overall image sharpness as the rest of the photograph
- The face must NOT look pasted onto a different body
- Match the neck, jawline, and facial lighting seamlessly into the body and scene
- Apply the same warm direct-light portrait tone uniformly across the face and body
- No beautification, no skin smoothing, no artificial symmetry
- Preserve realistic pores, facial texture, lip texture, beard shadow if applicable, and natural tonal variation
- The final styling must adapt naturally to the uploaded person regardless of gender while preserving the same recognizable identity

HAIR / GROOMING:
- Adapt the grooming naturally to the uploaded person
- Hair should feel intentional, polished, and luxury-portrait appropriate
- Facial hair, hairline, eyebrows, lashes, and edges must remain believable and identity-consistent
- No artificial wig-like texture
- No cartoon styling
- No over-designed beauty glam

ACCESSORIES:
- Oversized diamond-encrusted chain necklace with a large statement pendant
- Additional layered diamond chains around the neck
- Diamond grillz visible on the teeth
- Dark luxury sunglasses with reflective lenses and metal detailing
- Large diamond ring or iced-out hand jewelry visible near the face
- Jewelry must look heavy, real, premium, and physically believable with accurate reflections and gemstone sparkle
- No fake CGI jewelry look

CLOTHING:
- Dark luxury streetwear or upscale performance/studio styling
- Mostly hidden by the close-up framing, but any visible clothing should feel premium, dark-toned, and compatible with the jewelry-heavy look
- No fantasy costume elements
- No bright fashion-editorial wardrobe unrelated to the reference mood

SCENE:
- Extreme close-up or tight close-up portrait
- Dark background, almost black, with minimal visible environment
- Subject filling most of the frame
- One hand lifted near the face holding or touching the chain naturally
- Large pendant and layered jewelry occupying the lower foreground
- Composition should feel intimate, expensive, and aggressive in a real editorial/music-industry way

LIGHTING:
- Strong direct flash or hard frontal key light
- Bright specular highlights on skin, lips, glasses, ring, chains, and grillz
- Deep surrounding shadows with minimal ambient fill
- Slight warm tone in skin rendering
- Light should carve the face and jewelry clearly without looking like studio beauty lighting
- No soft commercial skincare lighting

CAMERA / LENS:
- Tight telephoto close-up feel or macro-like portrait crop
- Approximately 85mm to 135mm full-frame equivalent for compressed facial rendering, or a similarly tight close-focus portrait lens look
- Very close camera distance with intimate framing
- Shallow depth of field allowed, but the face, teeth, sunglasses, and front jewelry must remain sharp
- The background should fall into deep soft blur or blackness
- Real lens rendering only, not artificial blur

PHOTOGRAPH QUALITY:
- High-resolution modern digital portrait
- Crisp micro-contrast on jewelry and facial texture
- Slight gritty editorial sharpness
- Realistic sensor grain is allowed in darker areas
- No HDR
- No fantasy glow
- No overgrading
- No posterized skin
- No AI-looking skin plasticity
- Natural but dramatic contrast
- Real gemstone sparkle with small specular point highlights
- Must NOT look like concept art, fashion illustration, or a synthetic composite

MOOD:
- Bold, powerful, flashy, confident, expensive, confrontational, and iconic
- Feels like a real backstage or editorial portrait captured at the perfect moment
- The intensity should come from the lighting, jewelry, framing, and expression, not from changing the person’s identity

OUTPUT TARGET:
- Ultra-realistic luxury hip-hop close-up portrait
- Same recognizable person
- Dark background, hard light, diamond-heavy styling, premium editorial energy
- Looks like a genuine high-end music portrait, not AI-generated`
  },
  "hellotokyo": {
    "default": `Transform this photo into a stylized Tokyo-pop promotional collage portrait.

This must look like a real high-resolution digital editorial poster or graphic-design collage image — playful, chaotic, aspirational, glossy, and visually layered, with a deliberate mix of black-and-white urban photography and high-saturation cartoon-style graphic overlays. Not painterly. Not low-effort sticker spam. Not generic travel poster. Real editorial-collage design energy.

FACE — PRESERVE IDENTITY, INTEGRATE NATURALLY:
- Preserve the person's exact facial features: face shape, bone structure, eye shape, nose, lips, jawline, proportions, and instantly recognizable identity
- Keep the expression bright, surprised, energetic, and model-like, adapted naturally from the uploaded person
- CRITICAL: The face must feel naturally integrated into the collage image — same lighting direction, same contrast logic, same skin texture, and same overall image sharpness as the main photographic layer
- The face must NOT look pasted onto a different fashion body
- Match the head, neck, hairline, and visible skin seamlessly into the clothing, pose, and graphic composition
- No beautification that changes facial structure
- No plastic skin
- No artificial symmetry correction
- Preserve realistic pores, lip texture, subtle under-eye structure, and believable skin variation, even within the stylized editorial finish
- The final Tokyo-pop styling must adapt naturally to the uploaded person regardless of gender while preserving the same recognizable identity

FACE & CAMERA:
- Keep the subject instantly recognizable as the original user
- Preserve believable face proportions and hairline
- Maintain a real photographed portrait base, not an over-generated fantasy face
- Do not over-smooth the face or erase unique facial details
- The portrait base should feel like a fashion-editorial photo embedded into a graphic poster layout
- The subject should feel lively, energetic, youthful, and travel-poster ready

HAIR:
- Adapt the hairstyle naturally to the uploaded person while preserving recognizability
- Hair should feel playful, styled, youthful, and fashion-forward
- If the original hair allows, introduce soft lively movement and a slightly quirky Tokyo street-style finish
- No fantasy hair rendering
- No anime hair
- No wig-like texture
- Keep the result human and editorial

STYLING / OUTFIT:
- Pastel-toned layered street-fashion styling inspired by Harajuku or Tokyo youth fashion
- Yellow hoodie
- Tan skirt
- Playful layered clothing
- Fun scarf
- Large fluffy earmuffs
- The styling should feel cheerful, spontaneous, quirky, and fashion-editorial
- Keep the clothing colorful, youthful, and expressive without becoming costume cosplay
- No fantasy costume elements
- No random wardrobe substitution unrelated to the described look

POSE:
- Dynamic pose with one hand stretched dramatically toward the camera in extreme perspective
- The pose should suggest excitement, motion, invitation, and playful energy
- The forward-reaching hand must feel intentionally exaggerated by perspective, as if inviting the viewer into the scene
- Bright eyes, slightly opened mouth, glossy lips, and an excited, surprised, model-like expression
- The gesture should feel spontaneous and high-energy, not stiff

SCENE:
- Shibuya-style Tokyo urban environment
- Background city imagery should be primarily grayscale or black-and-white
- Use dense urban Tokyo street atmosphere with signage, architectural layers, and metropolitan energy
- The background should function as the photographic base for the collage
- It should feel like a travel-poster/editorial graphic celebrating Tokyo pop culture, youth culture, and visual overload

GRAPHIC OVERLAYS:
- Overlay colorful cartoon-style text, stickers, signs, symbols, and geometric design elements throughout the composition
- Required visible text elements must include:
  - “HELLO TOKYO”
  - “LET'S GO!”
  - “HEI TOKYO”
  - “PARTOFRUBY”
  - “START” inside a barcode-style box
- Include Japanese food references or stickers for:
  - ramen
  - onigiri
  - dessert
- Include graphic elements:
  - heart icon
  - yellow polka dots
  - stars
  - Japanese text “すごい”
  - Japanese text “こんにちは!”
- The collage should feel dense, energetic, whimsical, and intentionally overloaded, but still well-designed
- Typography should feel comic-book-like, pop, graphic, flat, and editorial
- Additional flat illustrations and digital enhancements are encouraged if they support the Tokyo-pop collage aesthetic
- No missing required text elements
- No minimalist layout
- No generic sticker pack look

EDITORIAL TEXT BLOCK:
- Include a bottom editorial-style text area describing Tokyo as the “Eastern Capital”
- Reference Tokyo’s history and culture
- Encourage adventure, discovery, and trying foods
- The lower text block should feel like real magazine/editorial copy integrated into the poster design
- The text area should support the travel-and-pop-culture theme without overpowering the subject

COLOR:
- The overall palette must prominently use neon green, yellow, pink, black, and white highlights
- Include and preserve the following HEX values explicitly as core design references:
  - #070504
  - #705d2d
  - #f2d792
  - #c3ad65
  - #f6f3ef
  - #957f43
  - #43c755
  - #f7d313
  - #ed9967
  - #e9d2ca
  - #f5ee3d
  - #37332c
  - #c35536
  - #888b84
  - #c6b4a9
- The palette should feel graphic, pop, playful, slightly chaotic, and editorially controlled
- The subject should remain readable against the louder color overlays
- Use black-and-white city background contrast against high-saturation overlays for stronger pop impact

LIGHTING:
- The subject should feel brightly lit in a clean editorial way
- The base portrait should retain believable real-photography light behavior
- Overlays and collage graphics may intensify the visual energy, but the face and clothing must still feel grounded in a real captured photo
- No fantasy glow
- No painterly lighting
- No muddy contrast
- Keep the image vibrant, readable, and punchy

LOOK / FINISH:
- Digital editorial / poster / graphic-design medium
- Crisp, polished, high-resolution finish
- Strong collage design language with flat illustrations, graphic text, and layered composition
- A mix of real photography, digital enhancement, and poster-like design treatment
- High-energy comic-book-inspired typography and layout
- The final result should feel like a professional promotional collage, not a random scrapbook
- No analog film look
- No painterly texture
- No low-resolution sticker spam
- No AI-looking incoherent layer clutter

COMPOSITION:
- The subject must remain the main focal point
- Use strong forward perspective from the outstretched hand
- Let the hand and arm create depth and motion into the frame
- Surround the subject with layered graphic elements, text, food icons, and urban Tokyo imagery
- Maintain a balanced but intentionally chaotic editorial layout
- The image should feel like a magazine cover, poster, or travel-culture promo spread
- The overall composition should be dense, whimsical, youthful, and instantly eye-catching

MOOD:
- Whimsical
- Chaotic
- Aspirational
- Quirky
- Spontaneous
- Playful
- Travel-hyped
- Pop-culture saturated
- Diverse, energetic Tokyo street-culture mood
- The excitement should come from the pose, graphic overload, travel atmosphere, and collage design, not from changing the person's identity

STRICT RULES:
- Keep the face identity exact
- Do not omit any required text elements
- Do not omit the Japanese text elements
- Do not omit the food references
- Do not omit the bottom editorial copy area
- Do not omit the HEX color values
- Do not turn the image into anime
- Do not make it painterly
- Do not reduce it to a simple poster with one or two stickers
- Keep it dense, graphic, youthful, and editorial

OUTPUT TARGET:
- Ultra-realistic Tokyo-pop promotional collage portrait
- Same recognizable person
- Dynamic hand-toward-camera perspective, pastel Harajuku-inspired styling, grayscale Shibuya-style Tokyo background, dense colorful graphic overlays, comic-style typography, food stickers, Japanese text, and editorial travel-poster energy
- Must visibly reflect these core palette references:
  - #070504
  - #705d2d
  - #f2d792
  - #c3ad65
  - #f6f3ef
  - #957f43
  - #43c755
  - #f7d313
  - #ed9967
  - #e9d2ca
  - #f5ee3d
  - #37332c
  - #c35536
  - #888b84
  - #c6b4a9
- Looks like a genuine high-end digital editorial collage or promotional poster, not AI-generated`
  },
  "mongolian-warrior": {
    "default": `Transform this photo into a Mongolian steppe warrior portrait.

This must look like a real high-resolution documentary photograph of a Mongolian warrior on the open grasslands — completely unretouched, raw, grounded, and authentic. Not fantasy art. Not stylized. Real.

FACE — PRESERVE IDENTITY, INTEGRATE NATURALLY:
- Preserve the person's facial features: bone structure, eye shape, nose, lips, proportions
- Same expression and gaze direction
- CRITICAL: The face must feel naturally integrated into the scene — same lighting direction, same contrast, same skin texture, and same overall image sharpness as the rest of the photograph
- The face must NOT look like it was pasted onto a different body
- Match the neck and face seamlessly into the body and scene
- Apply the same natural outdoor color tone uniformly across the face and body
- No beautification, no modern skin smoothing
- Add realistic outdoor skin texture: wind exposure, sun-touched skin, natural pores, slight dryness from open-air conditions

HAIR — MUST CHANGE COMPLETELY:
- Do NOT preserve the original hairstyle under any circumstances
- Replace with authentic Mongolian warrior hair appropriate to the scene
- Options: long black braid, partially braided hair, or tightly pulled-back practical warrior hair
- Hair must look natural, functional, and wind-touched
- No modern salon styling, no fashion-volume, no artificial polish

CLOTHING:
- Traditional Mongolian warrior clothing suitable for open-steppe travel and combat readiness
- Thick fur-lined leather jacket or deel-like outerwear with coarse natural materials
- Heavy dark blue wool trousers
- Sturdy camel-hide or leather boots
- Engraved belt or metal-detailed waist fastening
- Traditional geometric motifs on sleeves, sash, or trim
- Visible fur cuffs, layered garments, and practical historical construction
- No modern tailoring, no synthetic fabric look, no fantasy armor design

SCENE:
- Vast green Mongolian grassland steppe with rolling hills and distant horizon
- Bright open sky with large billowing clouds
- Natural daylight across the full landscape
- Subject standing upright in the field
- Quiver with feathered arrows visible on the back
- Holding a domed metal helmet naturally at the side
- Full body visible head to toe

PHOTOGRAPH QUALITY:
- High-resolution modern documentary outdoor portrait
- Crisp natural detail across the entire frame including face, clothing, and distant landscape
- Deep depth of field with both subject and horizon remaining clear
- No HDR exaggeration, no digital oversharpening
- Natural contrast, realistic daylight, balanced tonal range
- Realistic outdoor color palette: vibrant greens, muted browns, subdued blue sky, natural skin tones
- Slightly cinematic but still documentary-grade realism
- Must NOT look like fantasy concept art or a modern costume shoot
- Raw, grounded, physically believable`
    ,
    "tribal": `Transform this photo into a Mongolian tribal warrior portrait.

This must look like a real high-resolution documentary photograph of a Mongolian tribal warrior on the steppe — completely unretouched, raw, grounded, and authentic. Not fantasy art. Not stylized. Real.

FACE — PRESERVE IDENTITY, INTEGRATE NATURALLY:
- Preserve the person's facial features: bone structure, eye shape, nose, lips, proportions
- Same expression and gaze direction
- CRITICAL: The face must feel naturally integrated into the scene — same lighting direction, same contrast, same skin texture, and same overall image sharpness as the rest of the photograph
- The face must NOT look like it was pasted onto a different body
- Match the neck and face seamlessly into the body and scene
- Apply the same harsh outdoor daylight tone uniformly across the face and body
- No beautification, no modern skin smoothing
- Add realistic outdoor skin texture: sun exposure, wind dryness, natural pores, slight roughness from open-air conditions
- The final tribal-warrior styling must adapt naturally to the uploaded person regardless of gender, while preserving the same recognizable identity and maintaining a historically believable Mongolian warrior appearance

HAIR — MUST CHANGE COMPLETELY:
- Do NOT preserve the original hairstyle under any circumstances
- Replace with authentic Mongolian tribal warrior hair appropriate to the scene
- Options: tightly pulled-back hair, practical long hair, braided hair, or historically plausible warrior grooming adapted naturally to the uploaded person
- Hair must look functional, weather-exposed, and historically grounded
- No modern salon styling, no fashion-volume, no artificial polish

CLOTHING:
- Traditional Mongolian tribal warrior attire
- Thick patterned tunic in vivid cobalt blue with scarlet-orange trim and embroidered ornamental chest detailing
- Wide leather belt cinched at the waist with metal studs and visible fastening hardware
- Decorative sword in an ornate scabbard attached at the belt
- Heavy embroidered fur-trimmed outer coat draped over the shoulders like a mantle
- Conical felt hat with fur lining and ornate embroidery
- Rich textile textures, visible stitching, layered fabric weight, rough historical materials
- No modern tailoring, no synthetic fabric look, no fantasy armor design

SCENE:
- Nomadic Mongolian camp setting on grassy steppe hills
- Large traditional felt tent structure directly behind the subject, with weathered fabric, hide-covered surfaces, wooden support framing, and scattered gear near the edges
- Harsh direct daylight with strong shadows
- Subject standing upright, centered, proud and stoic
- Gripping a polished wooden spear with visible metal ornament or inlay
- Decorative sword and belt details clearly visible
- Three-quarters length portrait composition

PHOTOGRAPH QUALITY:
- High-resolution modern documentary outdoor portrait
- Subject in crisp focus
- Background tent and landscape subtly blurred with moderate depth of field
- Slight oversharpening effect typical of a modern smartphone image
- Harsh direct natural daylight with sharp shadow edges and bright specular highlights on metal details
- Natural but vivid color palette: cobalt blue, scarlet-orange, fur browns, weathered ivory tent fabric, muted grassland greens
- No HDR exaggeration, no fantasy glow, no cinematic overgrading
- Must NOT look like fantasy concept art or a studio costume shoot
- Raw, grounded, physically believable`
  },
  "american-rugby-player": {
    "default": `Transform this photo into an American rugby action portrait.

This must look like a real high-resolution sports photograph of an American rugby player in motion during a daytime match or training session — completely unretouched, raw, grounded, and authentic. Not poster art. Not stylized. Real.

FACE — PRESERVE IDENTITY, INTEGRATE NATURALLY:
- Preserve the person's facial features: bone structure, eye shape, nose, lips, proportions
- Same expression and gaze direction
- CRITICAL: The face must feel naturally integrated into the scene — same lighting direction, same contrast, same skin texture, same sweat sheen, and same overall image sharpness as the rest of the photograph
- The face must NOT look like it was pasted onto a different body
- Match the neck and face seamlessly into the body and scene
- Apply the same harsh sunlit outdoor color tone uniformly across the face and body
- No beautification, no modern skin smoothing
- Add realistic athletic skin texture: sweat, pores, sun exposure, slight specular highlights, natural compression and tension from exertion
- The final rugby-player styling must adapt naturally to the uploaded person regardless of gender, while preserving the same recognizable identity and maintaining a physically believable elite rugby-athlete appearance

HAIR — MUST CHANGE COMPLETELY:
- Do NOT preserve the original hairstyle under any circumstances
- Replace with authentic rugby-player grooming appropriate to the scene
- Options: very short athletic haircut, tightly controlled hair under headgear, or practical match-ready hair adapted naturally to the uploaded person
- Hair must look functional, sweat-affected, and sports-appropriate
- No salon styling, no fashion-volume, no artificial polish

CLOTHING:
- Tight-fitting modern American rugby uniform
- Shiny synthetic athletic jersey in vivid blue, red, and white team colors
- Large white number "42" clearly visible on the chest
- Logo patch on the chest or sleeve reading "RUGBY LEAGUE USA"
- Short athletic rugby shorts in matching blue
- Protective blue padded scrum cap or soft rugby headgear
- White socks and molded cleats with visible branded sportswear detailing
- Fabric must show realistic stretch, compression, sweat-darkening, seams, and athletic tension across shoulders, chest, arms, and thighs
- No fashion tailoring, no fantasy uniform design, no unrealistic armor-like shaping

SCENE:
- Outdoor rugby field under intense clear daylight
- Lush green grass pitch
- Background of blurred stadium seating, sideline barriers, and sunlit field surroundings
- Subject captured mid-run with strong forward motion
- Arms pumping naturally, torso engaged, athletic stride visible
- Dynamic sports-action framing from upper thigh to head or near full-body crop depending on the motion
- The subject remains the clear focal point, isolated from the background by lens compression and shallow depth of field

PHOTOGRAPH QUALITY:
- High-resolution modern sports-action photograph
- Shot with a professional DSLR or mirrorless sports camera
- Medium telephoto sports lens look, approximately 135mm to 200mm full-frame equivalent
- Fast shutter speed, around 1/1600 to 1/2500 sec, freezing the athlete sharply
- Aperture around f/2.8 to f/4 for shallow depth of field and strong subject separation
- Crisp focus locked on the face, upper torso, and leading leg
- Slight trailing-edge motion softness is allowed only minimally at the farthest moving extremities if it feels naturally captured in-camera
- Background turf and stadium elements should be strongly out of focus with smooth telephoto compression
- Slight modern digital oversharpening is acceptable if it matches a real sports-photo look
- Strong natural sunlight from camera left, creating hard specular highlights on skin, helmet, jersey, and legs
- Deep, clean shadows and bright rim accents along shoulders, arms, and thighs
- Saturated but natural sports-photo color: vivid blue, bold red, bright white, rich skin tones, deep green grass
- No HDR exaggeration, no fantasy glow, no cinematic overgrading, no artificial composite look
- Must NOT look like concept art, advertising illustration, or a studio athlete shoot
- Raw, energetic, physically believable`
  },
  "american-cheerleader": {
    "default": `Transform this photo into an American cheerleader portrait.
This must look like a real high-resolution athletic portrait photograph of an American cheerleader on a gymnasium court under strong arena lighting — completely unretouched, raw, grounded, and authentic. Not poster art. Not stylized. Real.

FACE — PRESERVE IDENTITY, INTEGRATE NATURALLY:
- Preserve the person's facial features: bone structure, eye shape, nose, lips, proportions
- Same expression and gaze direction
- CRITICAL: The face must feel naturally integrated into the scene — same lighting direction, same contrast, same skin texture, same highlight behavior, and same overall image sharpness as the rest of the photograph
- The face must NOT look like it was pasted onto a different body
- Match the neck and face seamlessly into the body and scene
- Apply the same gymnasium lighting color tone uniformly across the face and body
- No beautification, no modern skin smoothing
- Add realistic skin texture: natural pores, slight sweat sheen, mild specular highlights from strong arena lights and flash, believable facial dimension under hard lighting
- The final cheerleader styling must adapt naturally to the uploaded person regardless of gender, while preserving the same recognizable identity and maintaining a physically believable American cheerleader appearance

HAIR — MUST CHANGE COMPLETELY:
- Do NOT preserve the original hairstyle under any circumstances
- Replace with authentic cheerleader grooming appropriate to the scene
- Options: tightly tied high ponytail with a glossy ribbon, controlled performance hair, or neat competition-ready styling adapted naturally to the uploaded person
- Hair must look fixed in place, performance-ready, and realistically affected by strong overhead light
- No salon glamour styling beyond believable competitive cheer presentation
- No artificial fashion-volume or unrealistic hair design

CLOTHING:
- Sparkling American cheerleader uniform
- Opaque thick synthetic athletic fabric with metallic-thread shimmer woven into the surface
- Fitted top with vivid red accents, icy blue-green and off-white base tones, and realistic cheer uniform construction
- Matching fitted performance skirt or uniform bottom appropriate to competitive cheer styling
- Glossy ribbon tied into the hair
- Fabric must show realistic thickness, seam structure, stretch tension, and reflective highlights from direct arena lights and flash
- No fashion tailoring, no fantasy costume design, no unrealistic stagewear shaping

SCENE:
- Indoor gymnasium court
- Subject standing prominently under a strong concentrated spotlight
- High-angle upper-body close-up framing
- Background includes an out-of-focus scoreboard, bleacher seats, distant basketball hoops, and soft gym interior elements
- Most background details should dissolve into soft pastel bokeh, blur, and low-contrast haze under the bright lighting conditions
- The subject remains the clear focal point, isolated from the background by lens compression, light falloff, and shallow depth of field

PHOTOGRAPH QUALITY:
- High-resolution modern athletic portrait photograph
- Shot with a professional DSLR or mirrorless camera
- Moderate telephoto lens look, approximately 85mm to 135mm full-frame equivalent
- Aperture around f/2.8 to f/4 for upper-body isolation and smooth background blur
- Crisp focus locked on the face, hair ribbon, and upper torso
- Strong arena illumination plus direct photography flash
- Intense specular highlights on skin, hair ribbon, and metallic threads in the uniform
- Sharp drop shadows defining facial structure and clothing texture
- Vintage-feeling image treatment created in-camera or through authentic optical/image characteristics, not artificial over-stylization
- Slight haze across the image
- Light leaks visible along the frame edges
- Mild vintage grain
- Subtle chromatic aberration at the brightest highlighted edges
- Slight telephoto compression in facial and upper-body rendering
- No HDR exaggeration, no fantasy glow, no cinematic overgrading, no artificial composite look
- Color palette must preserve icy blue-greens, off-white, and vivid red accents with realistic gym-light behavior
- Must NOT look like concept art, fashion illustration, or a studio beauty shoot
- Raw, celebratory, physically believable`
  },
  "yakuza": {
    "default": `Use the uploaded image as the base and transform it, not generate a new person.

Transform the uploaded photo into a low-angle, mid-range urban crime-scene portrait set in an industrial exterior environment featuring a single middle-aged East Asian man.

This must look like a real high-resolution documentary-style photograph — raw, grounded, slightly nostalgic, and authentic with late 1980s to 1990s film characteristics. Not fantasy art. Not stylized. Not CGI. Real.

FACE — PRESERVE IDENTITY, INTEGRATE NATURALLY:
- Preserve the uploaded user's exact facial identity: bone structure, eye shape, nose, lips, jawline, proportions, and instantly recognizable likeness
- Maintain the same serious, hard-set expression and gaze direction unless minor adaptation is required for pose alignment
- CRITICAL: The face must feel naturally integrated into the body and scene — same lighting direction, same contrast, same skin texture, same film grain response, and same overall image sharpness as the rest of the photograph
- The face must NOT look pasted or composited unnaturally
- Match neck, jawline, skin tone, and perspective seamlessly
- No beautification that alters facial structure
- No plastic skin, no artificial symmetry correction
- Preserve pores, subtle skin variation, and natural detail
- The final result must adapt naturally regardless of gender while preserving identity

HAIR:
- Replace with a natural, practical hairstyle consistent with a middle-aged East Asian man in an urban underworld context
- Hair must look unstyled, functional, and grounded in realism
- No modern salon styling, no artificial polish

OUTFIT:
- Sleeveless yellow undershirt exposing full traditional Japanese irezumi tattoos across both arms
- Casual black trousers or dark slacks
- Footwear: either black leather shoes or red slippers (must remain visually present as a striking contrast element)
- Materials must appear physically real: fabric texture, natural creasing, realistic highlights
- No synthetic or costume-like artificial rendering

POSE / COMPOSITION:
- Low-angle, mid-range shot
- Full-body or three-quarter view with strong grounded presence
- Subject positioned low in frame, squatting or seated
- Hands forward actively handling a set of handcuffs with wrists linked together
- Slightly wide-angle perspective
- Subject centered and visually dominant
- Composition must feel like a real captured moment from a crime-scene or documentary context

BACKGROUND — REAL URBAN ENVIRONMENT:
- Industrial street or back-alley setting
- Nondescript concrete building wall in the background
- Visible hint of an open garage or warehouse entrance
- Ground scattered with:
  - Large stacks of bound money
  - Loose banknotes
  - A brick of white powder sealed in a plastic bag (suggesting drugs)
  - Two polaroid photographs implying evidence or a police sting operation
- Environment must feel raw, slightly worn, and physically real
- No stylization or artificial simplification

LIGHTING:
- Soft daylight illumination
- Subtle, diffuse shadows across the scene
- Balanced, naturalistic lighting
- Light must feel ambient and consistent with outdoor conditions
- No dramatic or stylized lighting effects

DEPTH & SEPARATION:
- Deep focus — all elements in sharp focus
- No motion blur
- Natural spatial depth with slight wide-angle distortion
- No artificial background blur or cinematic depth effects

PHOTO STYLE:
- High-resolution image with late 1980s to 1990s film characteristics
- Visible but subtle film grain
- Slight color fading and tonal compression
- No modern digital sharpness or HDR effects
- No painterly blending or stylization
- Must feel like a real archival or documentary photograph

COLOR:
- Dominant palette must reflect: #221a28, #a98a91, #98757e, #312533, #bc9fa0, #cfb2ae, #84606d, #50303c, #664553, #d69381, #c97868, #e0cbc5, #b85d54, #823d3e, #a54944
- Base tones: beige, gray, black, muted yellow
- Tattoos and red slippers provide visual contrast
- Overall palette must remain subdued, slightly desaturated, and film-like

MOOD:
- Gritty, tense, underworld atmosphere
- Suggestive of organized crime or a police sting scenario
- Slightly nostalgic due to film rendering
- Quiet but charged with narrative tension

STRICT RULES:
- Must use the uploaded image identity as the base, not generate a new face
- Only one person must be present in the scene
- Subject must remain photorealistic
- Background must remain fully real and not stylized
- Do not remove any props or environmental elements
- Do not modernize the image style
- Maintain full narrative consistency
- The uploaded user's face must remain fully recognizable

OUTPUT TARGET:
- Ultra-realistic gritty urban crime-scene photograph
- Real human subject with preserved identity
- Single tattooed man handling handcuffs in a low-angle composition
- Surrounded by money, drugs, and evidence in an industrial alley
- Rendered with authentic late 80s/90s film texture and color
- Looks like a genuine documentary or archival photograph, not AI-generated`,
    "mafia": `Use the uploaded image as the base and transform it, not generate a new person.

Transform the uploaded photo into a straight-on medium shot of a powerful, intimidating man seated in a worn high-back brown leather armchair, with two bodyguards standing close on either side, matching the tone, framing, texture, and photographic realism of a gritty high-end gangster editorial portrait.

This must look like a real high-resolution editorial photograph with a grounded, analog-luxury, crime-drama feel — dark, warm, heavy, controlled, and slightly menacing. Not glossy fashion advertising. Not clean commercial menswear photography. Not stylized illustration. Not CGI. Real.

FACE — PRESERVE IDENTITY, INTEGRATE NATURALLY:
- Replace the central seated subject’s face with the uploaded user’s face while preserving exact identity: face shape, bone structure, eye shape, nose, lips, jawline, proportions, skin texture, and instantly recognizable likeness
- Maintain the same dominant, calm, hardened, slightly menacing expression unless the uploaded photo naturally requires only a minimal adjustment
- CRITICAL: The face must feel naturally integrated into the seated body and smoky interior scene — same lighting direction, same contrast, same skin texture, same haze interaction, same photographic softness, and same overall image sharpness as the rest of the photograph
- The face must NOT look pasted, beautified, over-symmetrized, or like a polished AI-fashion face
- Match the head, neck, posture, skin tone, and perspective seamlessly into the seated pose
- Preserve realistic pores, subtle under-eye structure, lip texture, slight facial asymmetry, and believable skin irregularity
- No plastic skin
- No cosmetic beauty retouching
- No artificial jaw sharpening
- No glamour smoothing
- The final result must adapt naturally regardless of gender while preserving the same recognizable identity

FACE & CAMERA:
- Keep the subject instantly recognizable as the original user
- Preserve believable face proportions and natural facial structure
- The face must feel like it belongs to a real photographed person in a smoky room, not a luxury menswear campaign model
- Do not over-clean the skin
- Do not make the facial planes too symmetrical or idealized
- Keep slight natural realism in the cheeks, eyes, mouth, and brow area
- The image should feel like a real gangster-film still or prestige editorial portrait, not a modern corporate portrait
- The camera must feel physically present and observational, not digitally perfect

HAIR:
- Slicked-back dark hair
- Hair must look real, slightly dense, controlled, and naturally groomed
- Keep the styling severe and understated
- No exaggerated pompadour volume
- No ultra-glossy salon finish
- No overly perfect strand separation

CLOTHING:
- Dark slate-gray suit, not bright silver-blue
- The suit must feel expensive but restrained, with low-key sheen rather than flashy gloss
- Black tie
- Dark shirt or very subdued shirt treatment to keep the torso visually heavy and serious
- Fabric must show realistic fold compression, pressure creases, and subtle luster
- No shiny fashion-catalog tailoring
- No overly crisp luxury-ad look
- The clothing must feel like real editorial wardrobe photographed in warm interior light

POSE / COMPOSITION:
- Straight-on medium shot
- Central subject seated deep into a high-back leather armchair
- Body posture relaxed but dominant
- Legs crossed in a natural, slightly loose, commanding way
- One hand raised with a large cigar near the lips
- Fingers naturally curled around the cigar, not elegantly posed
- Gaze directed toward the camera
- The seated posture must feel like effortless power, not formal posing
- Composition must feel slightly imperfect and human, not hyper-symmetrical
- The bodyguards must stand close enough to frame the seated figure and reinforce pressure and control
- Keep the visual weight centered on the chair, torso, face, and cigar

BODYGUARDS:
- Two adult men in black suits
- They must read as bodyguards, not fashion models
- Hands clasped in front
- Neutral, controlled, intimidating posture
- Their faces may be partially cropped or de-emphasized
- They must remain secondary and somewhat anonymous
- Their suits should feel matte-to-subtly-sheened, heavy, and real
- No glamorous styling
- No editorial posing energy

PROP:
- Large cigar held by the central seated subject
- Thick smoke rising from the cigar and drifting across the face
- Smoke must partially obscure part of the face in a natural way
- The haze must interact with the lighting and soften visibility around one eye and upper facial area
- Smoke must feel dense, real, and imperfect
- No decorative smoke swirl effect
- No stylized vapor ribbon look

SCENE:
- Interior setting with ornate baroque wallpaper
- Warm brown wood motif elements and dark carved trim in the background
- High-back brown leather armchair with visible wear, tufted detailing, rounded arms, and nailhead trim
- Leather must look aged, slightly glossy from use, and richly textured
- The environment must feel opulent, old-world, heavy, and faintly oppressive
- The set should feel like a private office, back room, or power room rather than a hotel lobby or clean showroom
- Background details must support the mood but remain secondary to the seated figure

LIGHTING:
- Warm diffuse ambient lighting
- Soft but directional enough to give shape to the face, chair, suit, and smoke
- Lighting must feel low-key and interior, not bright studio-commercial
- Soft shadows with gentle falloff
- Subtle highlight bloom on the leather chair and suit lapels
- The smoke must catch the light softly
- No harsh spotlight
- No clean beauty-light setup
- No crisp modern ad-lighting

DEPTH & OPTICS:
- Standard lens perspective
- Moderate depth of field
- Subject and chair sharp, with natural falloff into the surrounding figures and background detail
- No extreme digital crispness
- No hyperreal sharpening
- Slight photographic softness consistent with premium editorial capture
- No motion blur
- The optics should feel expensive but natural, not computationally enhanced

PHOTO STYLE:
- High-resolution editorial photography
- Rich tonal depth, but not overly polished
- Slight analog warmth in rendering
- Natural texture in skin, leather, fabric, and smoke
- No exaggerated HDR
- No glossy luxury-campaign finish
- No over-clean compositing
- No obvious AI smoothness
- The result must feel like a real prestige crime-drama still or serious editorial portrait with believable physical atmosphere

COLOR:
- Dominant palette must reflect:
  - #0c1012
  - #191b1c
  - #303030
  - #4f4b48
  - #9f968f
  - #321f19
  - #4c2c21
  - #7a4c39
  - #6b6663
  - #8d6550
  - #85807b
  - #663928
  - #a5816b
  - #c6ac97
  - #e1cfbc
- Rich tobacco browns, deep charcoal blacks, muted warm grays, aged leather browns, and soft parchment-beige highlights
- The palette must stay warm, dark, grounded, and heavy
- Do not shift the suit toward cool metallic blue
- Do not brighten the scene into modern luxury-ad tonality
- Keep contrast controlled and cinematic, with warmth concentrated in the leather, wood, and wallpaper

MOOD:
- Powerful
- Controlled
- Intimidating
- Luxurious in a dark old-money way
- Cinematic
- Slightly menacing
- Smoldering
- Quietly threatening rather than flamboyant
- The scene must feel like authority, danger, and wealth in one frame

STRICT RULES:
- Must use the uploaded image identity as the base, not generate a new face
- The central seated figure must clearly reflect the user’s identity
- The final image must follow the tone of a gritty gangster editorial portrait, not a polished menswear ad
- Preserve all key elements: cigar, smoke partially obscuring the face, leather armchair, bodyguards, baroque wallpaper, wood detailing
- Keep the suit dark slate-gray, not bright steel-blue
- Maintain the relaxed but dominant crossed-leg pose
- Do not make the composition too perfectly symmetrical
- Do not over-beautify the face
- Do not make the bodyguards look like fashion models
- Do not clean up the smoke into a decorative effect
- Keep the scene physically believable and atmospherically heavy

OUTPUT TARGET:
- Ultra-realistic cinematic editorial portrait
- Same recognizable person as the central seated figure
- Dark slicked-back hair, dark slate-gray suit, black tie, large cigar, rising smoke partially veiling the face
- Worn brown leather armchair with nailhead trim
- Two black-suited bodyguards standing close on either side
- Warm baroque interior with dark wood and old-world luxury
- Looks like a genuine gangster-film still or prestige editorial photograph, not AI-generated`
  },
  "western-gunslinger": {
    "default": `Transform this photo into a Western gunslinger portrait.
This must look like a real high-resolution cinematic Western film still captured in a dusty Texas frontier town at daybreak — completely unretouched, raw, grounded, and authentic, with a much stronger sense of a real movie scene frozen at a decisive dramatic moment. Not fantasy art. Not stylized illustration. Real.

FACE — PRESERVE IDENTITY, INTEGRATE NATURALLY:
- Preserve the person's facial features: bone structure, eye shape, nose, lips, proportions
- Same expression and gaze direction unless the action of the scene naturally requires a slight shift in eye-line
- CRITICAL: The face must feel naturally integrated into the scene — same lighting direction, same contrast, same skin texture, same dust exposure, and same overall image sharpness as the rest of the photograph
- The face must NOT look like it was pasted onto a different body
- Match the neck and face seamlessly into the body and scene
- Apply the same early morning frontier light tone uniformly across the face and body
- No beautification, no modern skin smoothing
- Add realistic skin texture: dust, dry air exposure, light stubble or natural facial texture, subtle sun-weathering, pores, and slight shadowing under the eyes
- The final gunslinger styling must adapt naturally to the uploaded person regardless of gender, while preserving the same recognizable identity and maintaining a physically believable Western gunslinger appearance

HAIR — MUST CHANGE COMPLETELY:
- Do NOT preserve the original hairstyle under any circumstances
- Replace with authentic Western frontier grooming appropriate to the scene
- Options: rugged hat-flattened hair, practical short hair, loosely tied-back frontier hair, or naturally unpolished period-appropriate grooming adapted to the uploaded person
- Hair must look dust-touched, practical, and historically grounded
- No salon styling, no fashion-volume, no artificial polish

CLOTHING:
- Weathered brown leather cowboy hat with a worn brim
- Rugged thick canvas or oilskin duster coat with visible wear, dust, and creasing
- Checked frontier work shirt underneath
- Metal buttons and rough practical fastening
- Gun belt across the waist with silver studs and a polished metal buckle
- Holstered revolver clearly visible at the hip
- Heavy natural fabrics, leather, worn stitching, practical Western construction
- No modern tailoring, no synthetic fabric look, no fantasy costume design

SCENE:
- Dusty Texas frontier town main street
- Timber-framed wooden storefronts lining the road
- One visible hanging sign reading "GENERAL STORE"
- Dry dirt street, muted wooden facades, frontier architecture, and sparse early-morning town atmosphere
- The scene should feel like a real film moment just after or during the draw, not a static costume portrait
- The subject may be firing a revolver, lowering the gun just after a shot, or holding the weapon in a live standoff moment
- A thin trail of fresh smoke may rise naturally from the revolver barrel or cylinder gap if the shot has just been fired
- Add lived-in frontier detail: hitching posts, dust along the road edge, warped wooden boards, faint window reflections, tether rails, wagon traces, and sparse props that make the town feel inhabited but eerily still
- The world must feel like a believable Western set captured in-camera, not a themed backdrop
- The scene should suggest unseen opponents, off-screen danger, and immediate narrative consequence

ACTION / PERFORMANCE:
- The subject does NOT need to look directly into the camera
- A more cinematic off-axis eyeline is preferred: looking toward an off-screen threat, tracking someone across the street, or reacting in the split second after firing
- The body can be slightly twisted from recoil, stepping into the draw, or braced after the shot
- Coat hem, sleeve, dust, and gun arm may show subtle motion from the action
- The performance should feel tense, instinctive, and filmic, like a real actor caught in the middle of a gunfight beat
- No exaggerated action-movie posing
- No superhero stance
- Keep it grounded, dangerous, and physically believable

SHOT DESIGN / CAMERA ANGLE:
- Replace the static straight-on portrait feeling with a more dynamic movie-shot composition
- Use a lower or slightly canted camera angle, as if the camera operator is positioned in the street during the confrontation
- The shot can be a dynamic medium close-up, medium shot, or slightly wider hero frame depending on the action beat
- The frame should feel like part of an edited Western sequence: either the shot right before the draw, the instant of the gunshot, or the aftermath with smoke still in the air
- Slight Dutch tilt is allowed if subtle and motivated by the action
- Foreground occlusion such as drifting dust, a hitching post edge, or blurred wood detail is allowed if it increases immersion
- The composition should feel like a real dramatic insert or confrontation shot from a prestige Western feature film

PHOTOGRAPH QUALITY:
- High-resolution modern cinematic Western portrait
- Shot with a professional cinema camera or high-end DSLR/mirrorless system
- The image should feel like a frame extracted from a prestige Western film, not just a portrait
- Neutral-to-warm frontier color balance
- Early morning sunlight filtered through dust in the air
- Faded diffuse light beams allowed in the background and side atmosphere
- Soft but directional shadows under the hat brim and along the coat folds
- Stronger cinematic treatment is allowed: deeper mood, richer tonal separation, dust haze, and more dramatic atmospheric contrast while still remaining photographic
- Slight anamorphic-style atmosphere is allowed in the light response if it still feels photographic and period-appropriate
- No HDR exaggeration
- No fantasy glow
- No overdone blockbuster grading
- No artificial composite look
- Must NOT look like concept art, a costume photoshoot, or a theme-park reenactment
- Raw, dramatic, physically believable

LIGHTING:
- Early morning sun with soft but directional beams
- Slight dust diffusion in the air
- Face partially shadowed under the hat brim
- Gentle highlights on leather, belt buckle, revolver metal, and cheek structure
- No hard modern flash
- No glossy beauty lighting
- Light should feel naturally shaped by dust, wood reflections, and open-air frontier conditions
- Add stronger cinematic light separation between the subject and the background through dust-filled air and angled morning sun
- Let the sunlight feel low, fragile, and tense, as if the town has only just awakened
- If the revolver has just fired, allow faint smoke to catch the side light naturally

CAMERA / LENS:
- Use a real cinematic lens choice written directly into the shot language
- Preferred lens options:
  - 50mm anamorphic equivalent for a dramatic medium shot with environmental tension
  - 65mm spherical equivalent for a tighter, prestige-western character frame
  - 75mm to 85mm equivalent for a compressed reaction shot with smoke and shallow depth
- The most suitable default is a 65mm full-frame equivalent with shallow depth and strong subject isolation
- Keep crisp focus on the eyes, face, hat brim, revolver hand, and upper torso
- Background storefronts and signs rendered with natural lens falloff and selective softness
- Slight lens softness in the distant background is allowed
- Natural optical rendering only, not artificial blur
- Slight handheld micro-tension is allowed only if it still feels composed and cinematic
- The frame should feel like an intentional dialogue shot, post-shot reaction shot, or pre-draw standoff insert from a serious Western feature film

ATMOSPHERE / CINEMATIC INTENSITY:
- Add more dramatic frontier atmosphere
- Fine airborne dust drifting across the street
- Slight sun haze and suspended particulate catching the light
- A more severe, high-tension stillness in the frame
- Optional faint heat-dryness shimmer in the far background if subtle and realistic
- If the gun has just fired, include a restrained puff of smoke, a lingering barrel haze, or a barely visible recoil aftermath
- Add subtle environmental motion cues such as drifting dust, a coat edge barely moving, faint particles crossing the sunbeams, or the revolver hand still settling after the shot
- The image should feel like a premium Western film still captured at the exact moment before or after action
- No fantasy VFX
- No surreal smoke effects
- No exaggerated action-movie gimmicks

MOOD:
- Stoic, tense, cinematic, dangerous, lonely, and iconic
- Feels like a real Western film still with stronger dramatic intensity
- The power should come from the stare, dust, light, wardrobe, action beat, and frontier setting, not from changing the person’s identity
- The emotional tone should feel heavier, more suspenseful, and more narratively charged, like a scene from a serious period Western rather than a stylized cowboy portrait

OUTPUT TARGET:
- Ultra-realistic Western gunslinger portrait
- Same recognizable person
- Dusty Texas town, rugged cowboy styling, revolver belt, weathered textures, stronger cinematic atmosphere
- Dynamic movie-scene framing with real lens language, off-axis eyeline, and a live-action standoff or post-shot moment
- Feels like a genuine movie scene frozen one second before or after the duel
- Looks like a genuine dramatic Western film still, not AI-generated`
  },
  "drink-pov": {
    "default": `Transform this photo into a whimsical summer drink-point-of-view portrait.

This must look like a real high-resolution lifestyle photograph captured from inside a glass of red slushy drink on a bright sunny day — completely unretouched, playful, grounded, and authentic. Not fantasy illustration. Not cartoonish. Real.

FACE — PRESERVE IDENTITY, INTEGRATE NATURALLY:
- Preserve the person's exact facial features: face shape, bone structure, eye shape, nose, lips, jawline, proportions, and instantly recognizable identity
- Keep the same natural expression and gaze direction unless the source image composition requires only a minimal natural adjustment
- CRITICAL: The face must feel naturally integrated into the scene — same lighting direction, same contrast, same skin texture, same outdoor daylight behavior, and same overall image sharpness as the rest of the photograph
- The face must NOT look pasted above the glass
- Match the head, neck, lips, and facial perspective seamlessly into the drink POV angle
- Apply the same bright summer daylight tone uniformly across the face and body
- No beautification that changes facial structure
- No plastic skin
- No artificial symmetry correction
- Preserve natural pores, lip texture, subtle under-eye structure, and believable skin variation
- The final summer-drink styling must adapt naturally to the uploaded person regardless of gender while preserving the same recognizable identity

FACE & CAMERA:
- Keep the subject instantly recognizable as the original user
- Preserve believable face proportions and hairline
- Maintain a real photographed portrait feel, not an over-generated fantasy face
- Do not over-smooth the face or erase unique facial details
- The face should appear very close to the lens from a worm’s-eye-view angle, as if the camera is physically inside the glass looking upward
- The lips should be naturally pursed around a straw in a believable sipping moment
- The subject should gaze directly downward into the glass or slightly into the lens from above

HAIR:
- Keep the hairstyle naturally recognizable to the uploaded person
- Hair should feel slightly messy, glossy, lightly wind-touched, and casual
- Allow a few loose strands or soft bangs to fall naturally across the forehead
- Hair should respond realistically to the outdoor setting and top-down angle
- No fantasy hair styling
- No overbuilt editorial hair
- No wig-like texture

CLOTHING:
- Only a small hint of clothing should be visible
- Show a soft pink ribbed sleeveless top or a similarly minimal warm-weather top if adaptation is needed
- Clothing should remain secondary and softly out of focus
- Keep the styling casual, youthful, summery, and natural
- No fantasy costume elements
- No overly styled fashion-editorial wardrobe

SCENE:
- The camera viewpoint is inside a glass, looking upward through the circular rim
- A red slushy drink dominates the foreground with thick icy texture, frothy crushed ice, and vibrant saturated red color
- A light blue straw extends toward the subject’s lips
- The top inner rim of the glass should create a circular framing element around the subject’s face
- The red slush should occupy a large part of the foreground, partially out of focus due to the extreme perspective
- The background should reveal a clear blue sky, indicating a bright sunny outdoor setting
- The setting should feel refreshing, playful, summery, and real
- The point of view must clearly feel like the camera is placed inside the drink, not simply below the face

COMPOSITION:
- Low-angle worm’s-eye-view close-up
- Extreme perspective distortion from a wide-angle lens
- Circular glass rim framing the face above
- The subject’s face centered or slightly off-center above the straw
- Red slushy texture dominating the lower and side foreground
- Strong visual depth between foreground ice, straw, lips, face, and blue sky
- The image should feel immersive, quirky, and instantly eye-catching
- The composition should look like a real photographed beverage-campaign moment, not a surreal composite

LIGHTING:
- Bright natural daylight
- Crisp specular highlights across the skin, lips, straw, glass rim, and textured ice
- Clean summer sun with strong freshness and clarity
- No artificial flash
- No fantasy glow
- Light should feel direct, outdoor, refreshing, and realistic
- Maintain strong daylight contrast while preserving natural skin detail

COLOR:
- Dominant color palette:
  - vibrant red from the slushy drink
  - soft pink from the visible clothing
  - clean soft blue from the sky and straw
  - natural skin tones
- Keep the palette fresh, summery, saturated, and playful
- Strong contrast between red slush, blue sky, and warm skin tones
- No muddy grading
- No vintage tint
- No desaturated cinematic palette

PHOTO STYLE:
- High-resolution modern lifestyle photograph
- Wide-angle lens rendering with pronounced perspective distortion
- Deep depth of field feel, but with some natural foreground softness in the closest slush textures
- Crisp facial detail and realistic texture
- Premium commercial summer-photo quality
- No HDR exaggeration
- No cartoon rendering
- No painterly texture
- No artificial composite look
- The image should feel like a real photographed beverage or summer-lifestyle campaign

CAMERA / LENS:
- Wide-angle lens, approximately 18mm to 24mm full-frame equivalent
- Camera physically positioned inside the glass
- Pronounced close-range distortion that enlarges the lips, straw, and lower face slightly in a natural optical way
- Deep immersive perspective from the glass interior
- Real optical depth only, not fake blur
- Foreground slush and rim may fall slightly soft due to extreme proximity, while the face remains clearly readable

MOOD:
- Lively, quirky, whimsical, refreshing, youthful, and summery
- Feels like a playful real-life snapshot from a high-end beverage campaign or summer editorial
- The charm should come from the unusual drink POV, bright daylight, and natural facial expression, not from changing the person's identity

STRICT RULES:
- Keep the face identity exact
- Do not lose the inside-the-glass POV
- Do not remove the red slushy foreground
- Do not remove the light blue straw
- Do not make it look like a fantasy composite
- Do not over-retouch the skin
- Do not flatten the wide-angle distortion
- Keep it human, photographic, and physically believable

OUTPUT TARGET:
- Ultra-realistic summer drink POV portrait
- Same recognizable person
- Worm’s-eye-view from inside a red slushy glass, light blue straw at the lips, circular glass rim framing the face, clear blue sky above
- Vibrant red, pink, and blue summer palette
- Looks like a genuine high-end lifestyle beverage photo, not AI-generated`
  },
  "existential-studio": {
    "default": `Transform this photo into a minimalist existential studio portrait.

This must look like a real high-resolution contemporary studio photograph — stark, moody, introspective, and slightly surreal, with one sharply focused seated central figure and multiple motion-blurred suited figures moving around them. Not fantasy art. Not illustration. Not painterly. Real.

FACE — PRESERVE IDENTITY, INTEGRATE NATURALLY:
- Preserve the uploaded person's exact facial features: face shape, bone structure, eye shape, nose, lips, jawline, proportions, and instantly recognizable identity
- Only the central seated figure must use the uploaded person’s face and identity
- The surrounding blurred figures must NOT inherit the uploaded person's identity
- The blurred surrounding figures should remain generic anonymous adult males in black suits, rendered too motion-blurred to have specific recognizable faces
- CRITICAL: The central face must feel naturally integrated into the seated body and studio scene — same lighting direction, same contrast, same skin texture, and same overall image sharpness as the rest of the sharply focused subject
- The central face must NOT look pasted onto the seated body
- Match the neck, jawline, skin tone, and body posture seamlessly into the scene
- No beautification that changes facial structure
- No plastic skin
- No artificial symmetry correction
- Preserve realistic pores, subtle skin texture, lip texture, and believable facial detail on the central seated figure
- The final central-subject styling must adapt naturally to the uploaded person regardless of gender while preserving the same recognizable identity

FACE & CAMERA:
- Keep the central seated subject instantly recognizable as the original user
- Preserve believable face proportions and hairline
- Maintain a real photographed portrait feel, not an over-generated fantasy face
- Do not over-smooth the face or erase unique facial details
- The central seated figure must remain the only sharply readable identity in the image
- All other moving figures must remain secondary, anonymous, and motion-smeared

CENTRAL SUBJECT STYLING:
- Young adult seated at the center of a stark white studio
- Slightly loose short-sleeve white shirt
- Black pants
- Casual sneakers
- Lightly tousled natural hair adapted to the uploaded person if needed
- Styling should feel minimal, contemporary, neutral, and emotionally understated
- No fashion-editorial excess
- No costume elements
- No bright accent colors beyond subtle natural skin and clothing tones

SURROUNDING FIGURES:
- Multiple adult male figures in black suits moving briskly around the central subject
- These figures must remain generic and anonymous
- They should appear in both foreground and background
- Their movement should create strong motion blur, visual noise, and a sense of urgency
- They must NOT become sharp enough to compete with the central subject
- They must NOT resemble the uploaded person
- Their black suits should read as formal, minimal, and slightly imposing
- Their blurred bodies should create a ring of movement around the central seated figure

SCENE:
- Minimalist stark white studio environment
- Straight-on medium-wide framing
- Central subject seated cross-legged on the floor at the exact center of the composition
- Large empty white space around the seated figure
- Surrounding blurred figures moving through the frame in foreground and background
- The image should feel spatially clean but psychologically crowded
- The overall scene should emphasize isolation, existential detachment, and emotional stillness inside visual chaos

COMPOSITION:
- Straight-on medium-wide shot
- Central seated figure perfectly or near-perfectly centered
- Surrounding suited figures crossing the frame from multiple directions
- Strong visual contrast between stillness and motion
- The composition should use negative space effectively
- The central figure must remain visually dominant and fully readable
- The moving figures should frame, encircle, and pressure the composition without obscuring the seated subject’s identity
- The shot should feel balanced, graphic, and slightly surreal in a photographic way

LIGHTING:
- Clean, even studio lighting
- Neutral white backdrop and floor
- Soft controlled highlights on the central subject
- No dramatic colored lighting
- No theatrical spotlight
- No harsh beauty lighting
- Lighting should feel minimal, modern, and psychologically cold
- The central subject should be cleanly exposed and sharp
- The blurred figures should remain readable as dark moving silhouettes with slight skin-tone smears where visible

PHOTO STYLE:
- High-resolution modern digital studio photograph
- Central seated figure frozen in crisp focus
- Surrounding figures rendered with strong motion blur
- Clean digital image quality with negligible grain or noise
- Real photographic sharpness on the seated subject only
- The image should feel like a contemporary conceptual portrait shot in a professional studio
- No HDR exaggeration
- No fantasy glow
- No painterly texture
- No artificial composite look
- No low-fi blur filter

CAMERA / LENS:
- Straight-on medium-wide studio shot
- Wide-angle lens feel, approximately 28mm to 35mm full-frame equivalent
- Slight spatial exaggeration and depth between foreground blurred figures and centered seated subject
- The lens should preserve the central subject sharply while allowing the moving figures to streak naturally through the frame
- Use a shutter speed slow enough to create dramatic motion blur on the passersby, while the central figure remains crisply frozen
- Real optical rendering only, not fake blur

COLOR:
- Dominant monochrome palette of black, white, and cool gray tones
- The central seated subject should retain subtle natural skin tones and warm highlights
- The blurred passersby should remain mostly black, white, and neutral skin-tone smears
- Use the following HEX values as the core palette reference:
  - #010103
  - #d6d9db
  - #cdd2d6
  - #e0e1df
  - #c3c8cd
  - #b6bbc0
  - #a6abb3
  - #9396a0
  - #807e88
  - #656169
  - #1b1211
- The palette should feel restrained, modern, cold, and introspective
- No bright accent colors
- No warm cinematic grading

MOOD:
- Moody
- Introspective
- Slightly surreal
- Emotionally isolated
- Existential
- Stillness surrounded by urgency
- The power of the image should come from the contrast between the sharply focused seated subject and the blurred suited crowd, not from changing the person’s identity

STRICT RULES:
- Only the center seated figure uses the uploaded person's face and identity
- Do not apply the uploaded face to any surrounding moving figures
- Keep the surrounding blurred figures generic and anonymous
- Do not omit the motion blur effect
- Do not remove the stark white studio environment
- Do not add extra props or narrative objects
- Do not stylize it into fantasy or fashion campaign excess
- Keep the image photographic, minimal, and psychologically tense

OUTPUT TARGET:
- Ultra-realistic minimalist existential studio portrait
- Same recognizable uploaded person only on the centered seated figure
- Sharp central subject in white shirt and black pants, seated cross-legged
- Anonymous blurred black-suited figures moving around in foreground and background
- Stark white studio, monochrome palette, isolation-versus-motion tension
- Must visibly reflect these core palette references:
  - #010103
  - #d6d9db
  - #cdd2d6
  - #e0e1df
  - #c3c8cd
  - #b6bbc0
  - #a6abb3
  - #9396a0
  - #807e88
  - #656169
  - #1b1211
- Looks like a genuine high-end conceptual studio photograph, not AI-generated`
  },
  "transit-station-security": {
    "default": `Transform this photo into a candid transit-station security-camera portrait.

This must look like a real low-resolution surveillance-style image captured by a public transit security camera — raw, candid, slightly mischievous, and authentic. Not fantasy art. Not stylized illustration. Not polished editorial photography. Real.

FACE — PRESERVE IDENTITY, INTEGRATE NATURALLY:
- Preserve the person's exact facial features: face shape, bone structure, eye shape, nose, lips, jawline, proportions, and instantly recognizable identity
- Keep the same playful tongue-out expression if it fits the uploaded face naturally, or adapt it into a similarly candid mischievous expression
- CRITICAL: The face must feel naturally integrated into the security-camera scene — same lighting direction, same contrast, same skin texture, same low-resolution image behavior, and same overall image softness as the rest of the frame
- The face must NOT look pasted onto a different body
- Match the neck, jawline, skin tone, and visible body seamlessly into the surveillance-camera angle
- Apply the same cool-toned station lighting and digital artifact color shifts uniformly across the face and body
- No beautification that changes facial structure
- No plastic skin
- No artificial symmetry correction
- Preserve believable facial texture and recognizable identity even under surveillance-style softness and compression
- The final styling must adapt naturally to the uploaded person regardless of gender while preserving the same recognizable identity

FACE & CAMERA:
- Keep the subject instantly recognizable as the original user
- Preserve believable face proportions and hairline
- Maintain a natural candid portrait feel, not an over-generated fantasy face
- Do not over-smooth the face or erase unique facial details
- The image must feel like it was captured by an overhead station camera, not by a phone or fashion camera
- The subject should feel accidentally caught in-frame rather than posed for a portrait

CLOTHING:
- If the uploaded photo includes visible clothing, infer and preserve the user’s real outfit as closely as possible, adapting it naturally into the surveillance scene
- Keep the uploaded clothing’s apparent colors, silhouette, fit, and layering when possible
- If the uploaded image is only a selfie or does not provide enough outfit information, generate a believable outfit that fits the original scene:
  - light blue oversized denim jacket
  - matching baggy jeans
  - white cropped top or a similarly casual fitted inner layer adapted naturally to the uploaded person
  - white sneakers
- The final wardrobe should feel casual, youthful, slightly streetwear-coded, and believable for a transit-station candid moment
- No fantasy costume elements
- No random high-fashion substitution

PROP:
- A large white Valentino shopping bag
- Bold black serif text reading exactly: “VALENTINO”
- The bag should be clearly readable and naturally held by the subject
- The shopping bag must feel real, premium, and physically present in the scene
- No missing brand text
- No altered spelling

SCENE:
- Public transit station turnstile entry
- Straight-on but slightly downward-angled security-camera view
- Metal plate flooring and dark square tiles
- Subject standing near the turnstile gate
- Two blurred people in the distant background
- The environment should feel real, slightly impersonal, urban, and captured incidentally
- The overall scene should feel candid and slightly mischievous
- No glamorous retail setting
- No clean editorial backdrop

COMPOSITION:
- Straight-on, downward-angled medium shot from a surveillance camera position
- Slight overhead CCTV perspective
- Subject centered or near-centered within the frame
- Turnstile and floor geometry clearly visible
- Background figures remain small, distant, and blurred
- The shot should feel like a real security-camera still frame, not a deliberately composed fashion image

LIGHTING:
- Cool ambient transit-station lighting
- Flat overhead illumination
- Slightly harsh and digital-feeling tonal response
- Purple, blue, and green color shifts caused by surveillance-camera artifacts and chromatic aberration
- No beauty lighting
- No flash
- No cinematic spotlighting
- The lighting should feel impersonal, electronic, and real

DIGITAL SCREEN / CCTV FILTER FEEL:
- Match the attached reference’s exact digital-screen feeling more closely
- Add visible RGB channel separation and edge fringing around the subject and high-contrast contours
- Introduce soft VHS/CCTV-style chromatic aberration in magenta, cyan, and blue at the outer edges of the figure
- Apply low-resolution surveillance softness with slight scan-like screen texture
- Add mild digital bloom and glow around bright areas without making the image dreamy
- Include subtle compression artifacts, weak pixel softness, and faint screen-recorded monitor feel
- Allow slight color banding, signal noise, and electronic image instability if natural
- The result should feel like a paused frame from a station monitor or captured off a digital CCTV display
- Keep the effect controlled and realistic, not glitch-art or sci-fi UI

PHOTO STYLE:
- Grainy, low-resolution security-footage feel
- Digital artifacting
- Mild compression
- Slight chromatic aberration
- Slight color-channel instability with cool purple-blue-green shifts
- Imperfect sharpness and surveillance-camera softness
- The image should feel like a still grabbed from real CCTV footage or recorded from a station monitor
- No polished editorial clarity
- No HDR exaggeration
- No fantasy glow
- No AI-looking skin plasticity

COLOR:
- Preserve and visibly reflect these core palette references:
  - #52483f
  - #cbbdda
  - #3d3a45
  - #5a5358
  - #a3aaf0
  - #332d2d
  - #6a677d
  - #caac85
  - #bbbaef
  - #7f7db6
  - #8c8ddd
  - #9c897e
  - #806c5f
  - #aaa0b4
- The palette should feel cool, slightly distorted, urban, digital, and surveillance-like
- Keep the color shifts subtle but clearly present

MOOD:
- Candid
- Playful
- Slightly mischievous
- Urban
- Youthful
- Captured-by-accident energy
- The charm should come from the surveillance angle, the tongue-out expression, the shopping bag, and the imperfect digital image quality, not from changing the person’s identity

STRICT RULES:
- Keep the face identity exact
- Keep the surveillance-camera perspective
- Keep the transit-station turnstile setting
- Keep the Valentino shopping bag with readable “VALENTINO” text
- Keep the cool digital artifact look
- Match the attached reference’s digital-screen filter feel more closely
- If the uploaded clothing is visible, preserve and infer it into the result
- If only a selfie is uploaded, generate a believable outfit matching the scene
- Do not make it polished like fashion photography
- Do not turn it into a fantasy or luxury campaign image

OUTPUT TARGET:
- Ultra-realistic transit-station security-camera portrait
- Same recognizable person
- Surveillance-style downward angle, turnstile entry, grainy low-resolution digital look, cool purple-blue-green artifact shifts, large white Valentino shopping bag
- Stronger captured-from-monitor / digital-screen filter feeling with realistic CCTV chromatic fringing
- User’s real clothing preserved when visible, or believable scene-matching clothing generated when outfit is not visible
- Must visibly reflect these core palette references:
  - #52483f
  - #cbbdda
  - #3d3a45
  - #5a5358
  - #a3aaf0
  - #332d2d
  - #6a677d
  - #caac85
  - #bbbaef
  - #7f7db6
  - #8c8ddd
  - #9c897e
  - #806c5f
  - #aaa0b4
- Looks like a genuine security-camera still, not AI-generated`
  },
  "luxury-bedroom-bag": {
    "default": `Transform this photo into a luxury bedroom shopping-bag portrait.

This must look like a real high-resolution candid-luxury lifestyle photograph captured on a smartphone in a modern bedroom — playful, irreverent, stylishly nonchalant, and authentic. Not fantasy art. Not stylized illustration. Not glossy studio surrealism. Real.

FACE — PRESERVE IDENTITY, INTEGRATE NATURALLY:
- Preserve the person's exact facial features: face shape, bone structure, eye shape, nose, lips, jawline, proportions, and instantly recognizable identity
- Keep the same neutral, aloof, model-like expression unless the uploaded photo naturally requires only a minimal adjustment
- CRITICAL: The face must feel naturally integrated into the seated body and room scene — same lighting direction, same contrast, same skin texture, same smartphone-camera rendering, and same overall image sharpness as the rest of the photograph
- The face must NOT look pasted onto the person inside the shopping bag
- Match the head, neck, jawline, skin tone, tattoos if visible, and body posture seamlessly into the scene
- No beautification that changes facial structure
- No plastic skin
- No artificial symmetry correction
- Preserve realistic pores, lip texture, subtle under-eye structure, and believable skin variation
- The final styling must adapt naturally to the uploaded person regardless of gender while preserving the same recognizable identity

FACE & CAMERA:
- Keep the subject instantly recognizable as the original user
- Preserve believable face proportions and hairline
- Maintain a real photographed portrait feel, not an over-generated fantasy face
- Do not over-smooth the face or erase unique facial details
- The image should feel like a casually shot but aesthetically strong smartphone photo
- The person should feel like they are really sitting inside the bag, not composited on top of it

HAIR:
- Keep the hairstyle naturally recognizable to the uploaded person
- Hair should be long or medium-long if naturally plausible, straight or softly relaxed, dark brown or similarly natural dark tone unless the user’s uploaded hair clearly differs
- Hair should feel casual, slightly styled, fashion-aware, and believable in a real bedroom environment
- No fantasy hair design
- No overbuilt salon styling
- No wig-like texture

STYLING / OUTFIT:
- White spaghetti-strap top or a similarly minimal chic fitted top adapted naturally to the uploaded person
- Dark sunglasses
- Bracelets and rings
- Visible tattoos on the arms and hands if they suit the uploaded subject naturally or if the source material includes tattoo-compatible styling
- The overall styling should feel chic, fashion-conscious, irreverent, and casually luxurious
- No costume elements
- No random high-fashion wardrobe substitution unrelated to the described scene

PROP:
- A large glossy green shopping bag dominating the foreground
- Bold readable brand text on the front reading exactly: “BOTTEGA VENETA”
- The bag must feel oversized, premium, structured, glossy, and physically real
- The subject is seated inside the bag naturally, as if the bag is large enough to contain them
- The interaction between the body and the bag must feel believable in terms of weight, compression, and contact
- No missing brand text
- No altered spelling
- No generic unlabeled bag

SCENE:
- Well-lit modern bedroom
- Unmade bed with white linens and multiple pillows in the background
- To the right of the frame, a black nightstand holding:
  - a phone
  - a candle
  - bottled water
  - a segmented dish
- Light wood floor with visible grain
- The room should feel real, lived-in, casual, and stylish rather than staged like a showroom
- The environment should support the irreverent luxury-lifestyle tone

COMPOSITION:
- Medium shot
- The subject seated inside the oversized bag in the foreground
- Straight-on smartphone-camera framing
- The bag occupies a large portion of the lower frame and acts as the main anchor object
- The bed and nightstand remain clearly readable in the background
- Deep focus composition so the room and objects stay legible
- The shot should feel candid, slightly absurd, and fashion-aware without becoming surreal in an artificial way

LIGHTING:
- Soft diffuse daylight
- Bright but natural bedroom illumination
- Clean highlights on skin, sunglasses, bag surface, wood floor, and bedding
- No flash
- No dramatic studio beauty light
- No cinematic spotlighting
- The light should feel like real daytime room light entering through a window

PHOTO STYLE:
- High-resolution smartphone image
- Deep focus
- Crisp modern digital clarity
- Real bedroom-lifestyle photo rendering
- No visible film grain
- No painterly softness
- No fantasy glow
- No artificial composite look
- The image should feel like a premium candid social photo captured spontaneously in a real room

COLOR:
- The palette must be anchored by stark whites, deep blacks, and the bold green of the shopping bag
- Preserve and visibly reflect these core palette references:
  - #968976
  - #847863
  - #058545
  - #c9b5a0
  - #c6cac3
  - #0b120c
  - #9da9a2
  - #996e4c
  - #77644e
  - #575544
  - #049c58
  - #ece1cd
  - #e5c9af
  - #352d25
- The green bag should pop strongly against the neutral whites, blacks, woods, and skin tones
- Keep the color palette natural, expensive, and slightly playful
- No neon exaggeration
- No muddy grading

MOOD:
- Irreverent
- Playful
- Stylishly nonchalant
- Fashion-conscious
- Casual luxury
- Slightly absurd but fully believable
- The power of the image should come from the contrast between the everyday bedroom and the oversized luxury shopping bag, not from changing the person’s identity

STRICT RULES:
- Keep the face identity exact
- Keep the oversized glossy green bag
- Keep the readable “BOTTEGA VENETA” text
- Keep the modern bedroom setting with the unmade bed and black nightstand details
- Keep the smartphone-photo realism
- Do not turn it into a surreal fashion illustration
- Do not make it look like a clean studio set
- Do not omit the room objects
- Do not lose the casual candid energy

OUTPUT TARGET:
- Ultra-realistic luxury bedroom shopping-bag portrait
- Same recognizable person
- Seated inside a large glossy green BOTTEGA VENETA shopping bag
- White bedding, black nightstand, phone, candle, bottled water, segmented dish, light wood floor, soft daylight
- Must visibly reflect these core palette references:
  - #968976
  - #847863
  - #058545
  - #c9b5a0
  - #c6cac3
  - #0b120c
  - #9da9a2
  - #996e4c
  - #77644e
  - #575544
  - #049c58
  - #ece1cd
- #e5c9af
- #352d25
- Looks like a genuine high-end candid smartphone fashion-lifestyle photo, not AI-generated`
  },
  "cinematic-horseback": {
    "default": `Transform this photo into a cinematic horseback fashion portrait.

This must look like a real high-resolution fashion-editorial photograph captured outdoors on rolling grassy hills under a clear blue sky — elegant, dramatic, luxurious, romantic, and authentic. Not fantasy art. Not painterly. Not fairy-tale illustration. Real.

FACE — PRESERVE IDENTITY, INTEGRATE NATURALLY:
- Preserve the person's exact facial features: face shape, bone structure, eye shape, nose, lips, jawline, proportions, and instantly recognizable identity
- Keep the same calm, poised, model-like expression and gaze direction unless the uploaded photo naturally requires only a minimal adjustment
- CRITICAL: The face must feel naturally integrated into the horseback scene — same lighting direction, same contrast, same skin texture, and same overall image sharpness as the rest of the photograph
- The face must NOT look pasted onto the rider
- Match the head, neck, hairline, skin tone, and body posture seamlessly into the scene
- Apply the same direct natural daylight tone uniformly across the face and body
- No beautification that changes facial structure
- No plastic skin
- No artificial symmetry correction
- Preserve realistic pores, lip texture, subtle under-eye structure, and believable skin variation
- The final horseback-fashion styling must adapt naturally to the uploaded person regardless of gender while preserving the same recognizable identity

HAIR — MUST CHANGE COMPLETELY:
- Do NOT preserve the original hairstyle under any circumstances
- Replace with long, dark, voluminous hair appropriate to the scene
- Hair should feel elegant, slightly wind-touched, and naturally full
- The hair must read as luxurious and editorial while still remaining physically believable
- No fantasy hair design
- No overbuilt salon exaggeration
- No wig-like texture
- No artificial polish

CLOTHING:
- Extravagant off-white or ivory gown with dramatic ruffle shoulders
- Voluminous sculptural skirt
- Lustrous pleated fabric with rich dimensional texture
- Cascading layers of fabric spilling down the horse's flank and toward the grass
- Bare legs subtly visible beneath the dress
- Platform sandals visible beneath the hem
- The outfit should feel luxurious, romantic, and high-fashion
- No fantasy princess costume
- No medieval costume elements
- No random wardrobe substitution unrelated to the described look

SCENE:
- Open grassy hillside landscape
- Uneven green slope with scattered tufts of wildflowers
- Rolling hills in the background
- Open blue sky with light cloud dappling
- Subject seated elegantly atop a white horse with subtle gray speckles
- The horse stands alert and composed on the hillside
- The environment should feel expansive, free, romantic, and editorial
- No urban elements
- No fantasy castle backdrop
- No surreal environmental effects

POSE:
- Low-angle full-body portrait in vertical orientation
- Subject seated upright and regal on the horse
- Composed posture with calm shoulders and elongated torso
- The rider should feel statuesque, serene, and naturally balanced
- The horse and rider must feel physically connected and believable
- The dress should drape dramatically while preserving realistic weight and gravity

HORSE:
- White horse with subtle gray speckles
- Realistic anatomy, natural musculature, and calm alert stance
- Natural mane texture and believable facial detail
- Strength and serenity should both be visible in the horse's posture
- The rider must sit naturally with realistic balance and contact
- No fantasy unicorn styling
- No ornamental costume tack unless extremely minimal and realistic

PHOTOGRAPH QUALITY:
- High-resolution modern digital fashion photograph
- Slight golden-hour warmth layered into otherwise bright direct daylight
- Crisp shadows and clean sunlit detail
- Clear, premium editorial sharpness in the face, dress texture, and horse anatomy
- Natural outdoor contrast
- No HDR exaggeration
- No painterly softness
- No artificial composite look
- No obvious AI texture
- The image should feel like a real luxury fashion shoot captured outdoors

LIGHTING:
- Natural direct sunlight
- Clear crisp shadows
- Bright highlights across the dress folds, skin, and horse musculature
- Light should emphasize the lustrous pleated fabric and the horse's form
- No flash
- No fantasy glow
- No moody artificial lighting
- Light should feel open-air, refined, and photographic

CAMERA / LENS:
- Wide-angle lens with a slightly low viewpoint
- Approximately 28mm to 40mm full-frame equivalent
- Vertical full-body editorial framing
- Slightly low camera angle to emphasize the statuesque presence of both rider and horse
- Natural perspective with elegant environmental depth
- Moderate depth of field keeping rider and horse sharply readable while allowing distant hills to soften slightly
- Real optical rendering only, not fake blur

COLOR:
- Dominant palette of:
  - clean whites and ivory tones
  - lush greens
  - deep blue sky
  - natural warm skin tones
- Slight golden-hour warmth over the scene
- Preserve and visibly reflect these core palette references:
  - #335b70
  - #5c592d
  - #3f6779
  - #494925
  - #75663c
  - #dfd6b1
  - #5c7c85
  - #d2c69e
  - #c3b48b
  - #060f18
  - #b4a077
  - #30331d
  - #eee7c5
  - #9f8e69
  - #90774f
- Keep the palette clean, editorial, romantic, and sunlit
- No muddy grading
- No fantasy pastel wash
- No harsh oversaturation

MOOD:
- Romantic
- Free
- Elegant
- Luxurious
- Cinematic
- Dreamlike in a photographic way
- Calm, powerful, and editorial
- The beauty of the image should come from the real outdoor setting, the horse, the dress silhouette, and the preserved identity of the rider

STRICT RULES:
- Keep the face identity exact
- Keep the white horse with subtle gray speckles realistic
- Keep the extravagant pleated off-white gown with ruffle shoulders
- Keep the low-angle vertical full-body composition
- Keep the grassy hillside, wildflower tufts, rolling hills, and open blue sky
- Keep the platform sandals and visible bare legs if naturally visible
- Do not turn it into fantasy or fairy-tale imagery
- Do not make it painterly
- Do not lose physical realism in the rider-horse interaction
- Do not make the fashion styling look like costume cosplay

OUTPUT TARGET:
- Ultra-realistic cinematic horseback fashion portrait
- Same recognizable person
- White speckled horse, dramatic pleated off-white gown, rolling green hills, cloud-dappled blue sky, direct sunlight with slight golden warmth
- Low-angle vertical full-body editorial composition
- Must visibly reflect these core palette references:
  - #335b70
  - #5c592d
  - #3f6779
  - #494925
  - #75663c
  - #dfd6b1
  - #5c7c85
  - #d2c69e
  - #c3b48b
  - #060f18
  - #b4a077
  - #30331d
  - #eee7c5
- #9f8e69
- #90774f
- Looks like a genuine high-end outdoor fashion editorial photograph, not AI-generated`
  },
  "dreamy-wildflower": {
    "default": `Transform this photo into a dreamy wildflower field portrait.

This must look like a real high-resolution romantic outdoor editorial photograph captured in a lush field of pale pink wildflowers under bright daylight — calm, wistful, summery, and authentic. Not fantasy illustration. Not painterly. Not cartoonish. Real.

FACE — PRESERVE IDENTITY, INTEGRATE NATURALLY:
- Preserve the uploaded person's exact facial features: face shape, bone structure, eye shape, nose, lips, jawline, proportions, and instantly recognizable identity
- Keep the same gentle, contemplative, model-like expression and gaze direction unless the uploaded photo naturally requires only a minimal adjustment
- CRITICAL: The face must feel naturally integrated into the scene — same lighting direction, same contrast, same skin texture, and same overall image sharpness as the rest of the photograph
- The face must NOT look pasted onto a different body
- Match the head, neck, collarbone, skin tone, and body posture seamlessly into the scene
- Apply the same warm natural daylight tone uniformly across the face and body
- No beautification that changes facial structure
- No plastic skin
- No artificial symmetry correction
- Preserve realistic pores, lip texture, subtle under-eye structure, and believable skin variation
- The final floral-field styling must adapt naturally to the uploaded person regardless of gender while preserving the same recognizable identity

FACE & CAMERA:
- Keep the subject instantly recognizable as the original user
- Preserve believable face proportions and hairline
- Maintain a real photographed portrait feel, not an over-generated fantasy face
- Do not over-smooth the face or erase unique facial details
- The portrait should feel like a real outdoor editorial image with natural optical softness in the foreground only
- The face should remain the main sharp focal area of the image

HAIR:
- Keep the hairstyle naturally recognizable to the uploaded person
- Long hair flowing softly in the breeze if naturally plausible, or adapt the original hairstyle gently while preserving recognizability
- Hair should feel airy, summery, and lightly wind-touched
- No fantasy hair design
- No overbuilt salon styling
- No wig-like texture

STYLING / OUTFIT:
- Backless thin-strapped yellow lace dress
- Fine floral lace texture
- The dress should feel delicate, summery, and romantic
- One bare shoulder visible
- A small yellow blossom resting near the collarbone
- The outfit should harmonize with the surrounding flowers and field palette
- No fantasy princess costume
- No harsh fashion-editorial severity
- No random wardrobe substitution unrelated to the described look

SCENE:
- Lush field of blooming pale pink wildflowers
- Bright daylight sky
- Subject framed from behind and slightly to the side
- Head turned back toward the camera
- The setting should feel open, airy, and naturally beautiful
- Background sky with soft gradients of blue and fluffy clouds
- Foreground flowers softly blurred into dreamy bokeh
- The environment should feel summery, romantic, and slightly wistful

POSE:
- Low-angle full-body to three-quarter portrait feeling with strong environmental depth
- Subject seen from behind and slightly in profile
- Head turned back toward the camera
- Gentle, contemplative posture
- Bare shoulder exposed naturally
- The pose should feel graceful, spontaneous, and editorial without looking stiff

COMPOSITION:
- Low-angle wide shot
- Dynamic wide-lens depth between blurred near flowers and distant sky
- Subject placed prominently against the field and sky
- Foreground flowers rendered as soft dreamy blur
- The turned-back face should remain the emotional focal point
- The shot should feel open, expansive, and cinematic in a real photographic way

LIGHTING:
- Natural sunlight
- Warm diffuse highlights
- Bright but soft summer illumination
- No flash
- No fantasy glow
- Light should feel fresh, outdoor, and naturally flattering
- The highlights should gently lift the skin, lace texture, flowers, and hair
- Muted natural shadows only

PHOTO STYLE:
- High-resolution modern digital photograph
- Sharp around the subject
- Ethereal softness in the foreground flowers
- Real optical depth and wide-lens perspective
- No HDR exaggeration
- No painterly texture
- No artificial composite look
- No obvious AI texture
- The image should feel like a genuine high-end romantic outdoor editorial photograph

CAMERA / LENS:
- Wide-angle lens, approximately 24mm to 35mm full-frame equivalent
- Low-angle viewpoint
- Strong depth exaggeration between near flowers and distant background
- Real optical rendering only, not fake blur
- Subject sharp, foreground flowers softly out of focus
- Natural spatial depth and airy environmental perspective

COLOR:
- Dominant palette of pastel pinks, warm yellows, soft greens, and crisp sky blue
- Preserve and visibly reflect these core palette references:
  - #dedbe8
  - #cdccdf
  - #8f6e50
  - #795d41
  - #a28264
  - #caab99
  - #d9c1bb
  - #5d4f34
  - #acb6db
  - #3d462d
  - #252b21
  - #b59281
  - #849aca
  - #5c85b7
  - #baa171
- The palette should feel warm, airy, summery, romantic, and softly luminous
- No muddy grading
- No harsh oversaturation

MOOD:
- Calm
- Romantic
- Slightly wistful
- Summery
- Gentle
- Airy
- Editorial
- The beauty should come from the open field, turned-back pose, wind-touched hair, soft flowers, and preserved identity of the subject

STRICT RULES:
- Preserve the uploaded person's exact face identity strongly
- Keep the low-angle wide-shot feeling
- Keep the from-behind, head-turned-back pose logic
- Keep the pale pink wildflower field
- Keep the yellow lace dress and exposed shoulder
- Keep the yellow blossom near the collarbone
- Do not turn it into fantasy or fairy-tale imagery
- Do not make the face overly animated or porcelain
- Keep the image wearable, current, human, and photographic

OUTPUT TARGET:
- Ultra-realistic dreamy wildflower field portrait
- Same recognizable person
- Low-angle wide shot, pale pink wildflower field, yellow lace dress, turned-back pose, blue sky with soft clouds
- Foreground floral bokeh, summery daylight, wistful romantic mood
- Must visibly reflect these core palette references:
  - #dedbe8
  - #cdccdf
  - #8f6e50
  - #795d41
  - #a28264
  - #caab99
  - #d9c1bb
  - #5d4f34
  - #acb6db
  - #3d462d
  - #252b21
  - #b59281
- #849aca
- #5c85b7
- #baa171
- Looks like a genuine high-end outdoor romantic editorial photograph, not AI-generated`
  },
  "dreamy-celebratory": {
    "default": `Transform the uploaded photo into a dreamy celebratory portrait.

This must look like a real high-resolution digital photograph — luminous, jubilant, whimsical, and authentic, but with a much stronger bright dreamy filter layered over the entire image. The result should feel heavily light-washed, glowing, hazy, sparkly, softly overexposed, and atmospherically diffused in a photographic way. Not fantasy illustration. Not painterly. Not cartoonish. Real.

FACE — PRESERVE IDENTITY, INTEGRATE NATURALLY:
- Replace the original subject's face with the uploaded user's face
- Preserve the uploaded user's exact facial identity, bone structure, eye shape, nose, lips, jawline, proportions, skin texture, and instantly recognizable likeness
- The final result must adapt naturally whether the uploaded user is male or female
- Keep the uploaded user fully recognizable as the same person
- CRITICAL: The face must feel naturally integrated into the scene with matching lighting direction, contrast, skin detail, and overall image sharpness
- The face must NOT look pasted onto a different body
- Match the neck, face, skin tone, and facial perspective seamlessly into the body and scene
- No beautification that changes facial structure
- No plastic skin
- No artificial symmetry correction
- Preserve recognizable facial identity even under a heavy dreamy filter
- The face should remain real and human beneath the glow, bloom, haze, and light spread

HAIR:
- Preserve the uploaded user's exact hairstyle from the original photo
- Keep the same haircut, length, silhouette, texture, parting, bangs, hairline, color, and overall styling cues
- Do NOT restyle the hair into a different feminine, masculine, longer, shorter, wavier, or more editorial hairstyle
- The hairstyle must remain clearly recognizable as the user's real hair from the uploaded image
- Only allow minimal natural movement caused by the pose, sunlight, and atmosphere
- Fine strands may softly dissolve into the dreamy light haze, but the hairstyle itself must not change

POSE / EXPRESSION:
- Eye-level, slightly high-angle medium shot
- Subject leaning back and raising the face blissfully toward the sun
- Eyes closed
- Expression of serene delight
- Body language should feel open, light, and joyfully immersed in the moment

CLOTHING:
- Preserve the uploaded user's exact clothing from the original photo
- Keep the same outfit type, colors, fabric behavior, fit, layering, and styling cues from the uploaded image
- Do NOT replace the outfit with the Fair Isle sweater, skirt, or any generated wardrobe
- The clothing must remain clearly recognizable as the user's original outfit while being naturally integrated into the dreamy celebratory scene
- Fabric should catch soft glowing highlights, haze, and light bloom naturally
- Keep wrinkles, folds, seams, and material behavior consistent with the real uploaded clothing
- If only a partial outfit is visible in the uploaded photo, infer the rest conservatively so the final clothing remains faithful to the original look
- No fantasy costume elements
- No random wardrobe substitution

SCENE:
- Tiled stone courtyard
- Strong shaft of natural light entering from the upper right
- Distinct geometric shadows across the ground
- Scattered metallic confetti and sparkles floating in the air
- Confetti should reflect sunlight and create glittering starbursts and prismatic bokeh between the subject, the ground, and the lens
- The setting should feel ethereal, celebratory, and sunlit

LIGHTING:
- Bright natural sunlight
- Sparkling highlights on the skin
- Clear, crisp light behavior on the face, clothing, and confetti
- Sunlight should emphasize the luminous and dreamlike atmosphere
- Light should feel clean, vibrant, and real
- Add much stronger bloom and halation around bright areas
- Let highlights spread softly outward into the surrounding air
- Allow bright confetti reflections to flare and shimmer more strongly
- Introduce a washed, milky light veil across the whole frame
- Bright areas may feel softly overexposed in a beautiful photographic way
- Whites, creams, silvers, and skin highlights should glow noticeably

FILTER / DREAM EFFECT:
- Apply a strong bright dreamy filter across the whole result
- The image should feel heavily diffused, glowy, and softly radiant
- Add visible light bloom, highlight bleed, halation, haze, and luminous overexposure
- Add a slightly milky white veil over the frame, as if shot through heavy diffusion glass or a dreamy mist filter
- Include subtle analog-like noise or fine grain so the image does not feel clean-AI or plasticky
- Add slight light spill, soft flare, and gentle washed highlight rolloff
- Let sparkles and confetti produce stronger starburst glints and dreamy scattered reflections
- Reduce harsh edge clarity and lower global micro-contrast
- The image should feel soft, creamy, filtered, and expensive rather than digitally sharp
- The dreamy effect must feel photographic and optical, not like a fake app filter
- Avoid crisp AI sheen
- Avoid hyper-clean digital rendering
- The final result should feel like a real photo shot through strong diffusion with bright post-processed glow

PHOTO STYLE:
- High-resolution digital camera or premium smartphone image quality
- Moderate depth of field
- Subject remains the main focal point
- Falling confetti may blur and catch highlights naturally
- Strong filter-like post-processing is allowed
- Add slight analog-style noise and soft textural grain
- Add blooming highlights, soft focus, glow haze, and light bleed
- Reduce clean digital sharpness
- The result should feel less synthetic and more like an actual overfiltered dreamy photograph
- Real photographic rendering only, not painterly or artificial

COLOR:
- Dominant cool blues and silvers
- Accents of cream and faint peach
- Preserve and visibly reflect these core palette references:
  - #324957
  - #2a363e
  - #355666
  - #c8c6be
  - #d7d5cb
  - #1d1f1e
  - #192531
  - #888b90
  - #6b757d
  - #556167
  - #b4b3ae
  - #a19d9b
  - #957568
  - #f4f4ee
  - #5c4c42
- Let the palette feel brighter, milkier, and more light-flooded
- Slight lifting of whites and pale tones is encouraged
- Keep the blues, silvers, creams, and faint peach tones softly glowing rather than clinically crisp

MOOD:
- Dreamlike
- Jubilant
- Whimsical
- Ethereal
- Celebratory
- Light-filled
- Emotionally open and radiant
- Intensely glowy and sparkling
- Softly surreal in a photographic way

STRICT RULES:
- The uploaded user's face must replace the original subject's face
- This must work naturally whether the uploaded user is male or female
- The uploaded user's clothing must remain the same as in the uploaded photo
- The uploaded user's hairstyle must remain the same as in the uploaded photo
- Do not substitute or redesign the outfit
- Do not restyle, lengthen, shorten, recolor, or change the hair
- Keep the uploaded user clearly recognizable
- Do not make the face look pasted on
- Do not change the basic shot, confetti, courtyard, or lighting concept
- Do not turn it into fantasy illustration or cartoon styling
- Do not keep the result too digitally sharp or clinically clean
- Avoid obvious AI image clarity
- Prioritize heavy dreamy filter atmosphere, soft haze, light bloom, slight noise, and bright glowing diffusion

OUTPUT TARGET:
- Ultra-realistic dreamy celebratory portrait
- Same recognizable uploaded user
- Same original outfit from the uploaded photo
- Same original hairstyle from the uploaded photo
- Sunlit stone courtyard, metallic confetti, sparkling highlights, dreamy jubilant mood
- Strong bright dreamy filter with heavy bloom, haze, glow, light spill, soft overexposure, slight analog noise, and luminous sparkle
- Must visibly reflect these core palette references:
  - #324957
  - #2a363e
  - #355666
  - #c8c6be
  - #d7d5cb
  - #1d1f1e
  - #192531
  - #888b90
  - #6b757d
  - #556167
  - #b4b3ae
  - #a19d9b
- #957568
- #f4f4ee
- #5c4c42`
  },
  "romantic-night-twoshot": {
    "default": `Use the uploaded image or uploaded images as the base and transform them, not generate a new person.

Transform the uploaded photo set into a wide-angle romantic night scene featuring exactly two young adults standing together and holding hands on a hilltop overlooking a vast illuminated cityscape.

This must look like a real high-resolution cinematic editorial photograph — romantic, dreamy, natural, and grounded in physical realism. Not fantasy art. Not stylized illustration. Not CGI. Real.

SUBJECT COUNT / IDENTITY SOURCE — MUST FOLLOW EXACTLY:
- The final image must contain exactly two young adults only
- No extra people, no third subject, no crowd, no silhouettes, no background human figures
- Use only the uploaded image identities as the source for both faces
- This is an edit using uploaded people, not a newly invented couple
- Two uploaded face photos are provided and both must be used
- Map uploaded person 1 to one final subject and uploaded person 2 to the other final subject
- Preserve each uploaded identity separately
- Do not average, merge, remix, or partially invent either face
- Do not turn one uploaded face into both people unless both uploaded photos are actually the same person
- Do not hide either face behind hair, extreme angle, shadow, hands, or blur
- Both final faces must be readable enough to clearly preserve identity

FACE — PRESERVE IDENTITY, INTEGRATE NATURALLY:
- Replace both subjects’ faces using only the uploaded face images as identity sources
- Preserve exact identity: face shape, bone structure, eye shape, nose, lips, jawline, proportions, and instantly recognizable likeness
- Maintain soft, calm, emotionally connected expressions unless minimal adjustment is required
- CRITICAL: The faces must feel naturally integrated into the scene — same lighting direction, same contrast, same skin texture, same night-light interaction, and same overall image sharpness as the rest of the photograph
- The faces must NOT look pasted or overly symmetrical
- Match head, neck, posture, skin tone, and perspective seamlessly into both bodies
- No beautification that alters facial structure
- No plastic skin, no artificial symmetry correction
- Preserve pores, subtle skin variation, and natural detail
- The final styling must adapt naturally to each uploaded person’s gender while preserving identity and romantic pairing context

FACE & CAMERA:
- Keep both subjects recognizable as the uploaded user identities
- Preserve believable face proportions and natural structure
- Maintain a real photographed cinematic moment, not an over-generated couple
- Do not over-smooth or idealize facial features
- The camera must feel physically present and observational
- Capture using a full-frame professional camera system
- Lens: 35mm wide-angle lens (environmental portrait)
- Aperture: f/1.8 to f/2.2 to achieve shallow depth of field with strong background bokeh
- Shutter speed: approximately 1/80 to 1/125 sec for handheld stability
- ISO: 800 to 1600 to realistically accommodate low-light conditions with controlled noise
- White balance: cool night balance around 3800K to 4500K to preserve blue/violet tones
- Dynamic range: preserved highlights in city lights with soft roll-off and lifted shadow detail
- No digital over-sharpening; maintain natural lens softness and highlight bloom

HAIR:
- Natural, softly styled hair consistent with a romantic outdoor night setting
- Slight movement or looseness in strands
- No rigid or overly polished styling

CLOTHING:
- Young man: light brown textured suit with a white shirt
- Young woman: flowing white off-the-shoulder dress with puffed sleeves
- Fabrics must appear physically real with natural folds, flow, and light interaction
- Slight movement in the dress fabric to enhance softness
- No synthetic or costume-like rendering

POSE / COMPOSITION:
- Wide-angle shot at eye level
- Both subjects standing close together holding hands
- Positioned slightly off-center to allow expansive background visibility
- Natural, relaxed posture conveying intimacy
- Balanced composition using environmental negative space
- Foreground subtly uneven with hints of grass or bush framing one side
- Keep both faces clearly visible and unobstructed
- The frame may be wide, but both subjects must still be large enough in frame for facial identity to remain recognizable
- Do not place one subject too far away, turned away, or cropped so heavily that identity is lost

SCENE:
- Hilltop setting at night
- Foreground dark and textured with uneven ground
- Background: vast cityscape filled with thousands of lights
- City lights rendered as soft bokeh in blue and violet haze
- Strong contrast between dark foreground and luminous background
- Environment must feel real, expansive, and atmospheric

LIGHTING:
- Soft, diffuse artificial lighting illuminating the subjects
- Light must feel subtle and natural, not staged
- Gentle highlight on faces and clothing
- Background lights create natural glow and separation
- No harsh spotlight or artificial lighting effects

DEPTH & OPTICS:
- Wide-angle perspective with environmental depth
- Shallow depth of field
- Background rendered as soft, diffused bokeh
- Subjects remain sharp with slight natural falloff
- Subtle optical bloom around highlights
- No motion blur
- Lens rendering must feel physical and natural, not computational

PHOTO STYLE:
- High-resolution digital photography
- Cinematic but grounded realism
- Natural highlight bloom and soft contrast
- Slight low-light noise consistent with ISO usage
- No HDR exaggeration
- No painterly blending
- No AI-smooth rendering
- Must feel like a real romantic editorial or film still

COLOR:
- Dominant palette:
  - #4c5590
  - #040a0b
  - #343a7b
  - #3f4887
  - #2e346a
  - #0a121d
  - #5b659b
- Deep blues and midnight blacks dominate
- Accents of warm yellow and white from city lights
- Maintain cool atmospheric tone with warm contrast points
- No artificial color grading shifts

MOOD:
- Romantic
- Dreamy
- Cinematic
- Nostalgic
- Slightly surreal but grounded
- Sense of wonder and emotional intimacy

STRICT RULES:
- Must use the uploaded images as the base, not generate new faces
- The final image must contain exactly two people only
- Both uploaded identities must appear clearly and separately in the final image
- Preserve hand-holding interaction and emotional connection
- Maintain wide composition and cityscape background
- Do not stylize or turn into fantasy imagery
- Do not over-perfect faces or symmetry
- Keep lighting, texture, and atmosphere physically believable
- Do not invent a new romantic partner identity
- Do not obscure either face

OUTPUT TARGET:
- Ultra-realistic cinematic romantic portrait
- Two subjects holding hands on a hilltop at night
- Vast glowing cityscape in soft bokeh behind them
- Cool-toned atmosphere with warm light accents
- Looks like a real film still or editorial photograph, not AI-generated`
  },
  "escalator-flash-twoshot": {
    "default": `Images 1 and 2 are uploaded source identities for a single combined edit. Use both uploaded people exactly as the only identity source and create one final image. Additional instructions:
Use the uploaded image or uploaded images as the base and transform them, not generate a new person.

Transform the uploaded photo set into a high-angle direct-flash escalator snapshot featuring exactly two Korean adults riding the same escalator in a modern indoor public building, captured in a candid, slightly chaotic, comedy-film-still moment.

This must look like a real high-resolution film-style candid photograph — spontaneous, funny, observational, slightly messy, and grounded in physical realism. Not fantasy art. Not stylized illustration. Not CGI. Real.

SUBJECT COUNT / IDENTITY SOURCE — MUST FOLLOW EXACTLY:
- The final image must contain exactly two primary Korean adults only
- Use only the uploaded image identities as the source for both faces
- This is an edit using uploaded people, not newly invented strangers
- Two uploaded face photos are provided and both must be used
- Map uploaded person 1 to one final subject and uploaded person 2 to the other final subject
- Preserve each uploaded identity separately
- Do not average, merge, remix, or partially invent either face
- Do not turn one uploaded face into both people unless both uploaded photos are actually the same person
- Do not hide either face behind hair, extreme angle, shadow, hands, railings, or blur
- Both final faces must be readable enough to clearly preserve identity
- No extra clearly readable foreground or midground people
- If tiny distant background figures appear at the far end of the escalator or upper landing, they must remain very small, indistinct, and non-competing

FACE — PRESERVE IDENTITY, INTEGRATE NATURALLY:
- Replace both subjects’ faces using only the uploaded face images as identity sources
- Preserve exact identity: face shape, bone structure, eye shape, nose, lips, jawline, proportions, and instantly recognizable likeness
- Maintain playful surprise, quick upward glance, and candid caught-off-guard energy unless minimal adjustment is required
- CRITICAL: The faces must feel naturally integrated into the escalator snapshot — same lighting direction, same direct-flash behavior, same contrast, same skin texture, same slight motion softness, and same overall image sharpness as the rest of the photograph
- The faces must NOT look pasted or overly symmetrical
- Match head, neck, posture, skin tone, and perspective seamlessly into both bodies
- No beautification that alters facial structure
- No plastic skin, no artificial symmetry correction
- Preserve pores, subtle skin variation, and natural detail
- The final styling must adapt naturally to each uploaded person’s gender while preserving identity and the candid comedic public-space context

FACE & CAMERA:
- Keep both subjects recognizable as the uploaded user identities
- Preserve believable face proportions and natural structure
- Maintain a real photographed candid moment, not an over-generated staged pair
- Do not over-smooth or idealize facial features
- The camera must feel physically present, handheld, close, and intrusive
- Capture using a compact 35mm point-and-shoot or direct-flash snapshot camera aesthetic
- Lens: 28mm wide-angle lens
- Aperture: approximately f/4 to f/5.6
- Shutter speed: approximately 1/30 to 1/60 sec
- ISO: 400 to 800 film-equivalent grain response
- White balance: mixed indoor ambient with flash-neutral foreground
- Direct on-camera flash must dominate the subjects while ambient mall light remains visible in the background
- No digital over-sharpening; maintain slight optical softness, film grain, flash glare, and snapshot realism

HAIR:
- Preserve each uploaded person’s natural hairstyle
- Hair must react naturally to movement, escalator motion, and direct flash
- Slight flyaway strands and uneven shine are allowed
- No rigid or overly polished styling

CLOTHING:
- Both subjects must wear casual, loose-fitting everyday public-building outfits
- Clothing must adapt naturally to each uploaded person’s gender while preserving realistic street-casual styling
- All garments must read as thick, opaque, everyday materials such as denim, cotton, and canvas
- Fabrics must appear physically real with natural folds, weight, and movement
- Clothing should feel similar in spirit to candid streetwear worn in the reference mood: practical, slightly oversized, and not fashion-editorial
- No synthetic or costume-like rendering
- No formal styling
- No fashion-shoot exaggeration

POSE / COMPOSITION:
- High-angle shot looking down the escalator
- Both subjects are on the same escalator, close together, captured mid-ride
- Both subjects twist their upper bodies and look up toward the camera
- One subject may be slightly ahead or behind the other on the steps
- The poses must feel candid, playful, and slightly awkward, as if suddenly noticed by the camera
- The frame must feel close, compressed, and immediate rather than architectural and distant
- Do NOT use a top-down X-shaped escalator intersection composition
- Do NOT place the subjects far apart across separate escalators
- Do NOT build the image around perfect symmetry
- The escalator steps must create strong downward leading lines beneath them
- Keep both faces clearly visible and unobstructed
- The subjects must be large enough in frame for facial identity to remain clearly recognizable

SCENE:
- Modern indoor public-building or shopping-mall escalator environment
- One escalator descending away from the camera
- Visible escalator handrails and metallic side panels
- Upper landing area visible in the distant background
- Minimal surrounding architecture compared with the subjects and escalator
- Environment must feel like a real indoor escalator corridor, not a grand geometric mall atrium
- Background should feel secondary, slightly empty, and naturally lit
- If distant people appear far away, they must remain tiny and incidental only

LIGHTING:
- Strong direct on-camera flash is the primary lighting source
- Flash creates bright frontal illumination on faces, hands, clothing, and escalator edges
- Ambient indoor lighting remains visible in the background
- Flash must create hard specular highlights, slight hot spots, and abrupt light falloff
- Shadows must feel direct, immediate, and snapshot-like rather than soft commercial lighting
- No polished mall-beauty lighting
- No cinematic spotlighting
- No overhead architectural-light drama as the main effect

DEPTH & OPTICS:
- Wide-angle perspective with close subject distance
- Moderate depth of field typical of direct-flash snapshot photography
- Subjects remain readable and prominent
- Background remains visible but less important
- Slight wide-lens exaggeration and closeness must be felt
- Mild motion softness is allowed in hands, feet, or escalator movement
- No deep, perfectly clinical architectural focus across the whole frame
- Lens rendering must feel physical, candid, and slightly imperfect

PHOTO STYLE:
- High-resolution film-snapshot / direct-flash candid photography
- Strong flash foreground separation
- Visible film grain or film-like noise
- Slight softness and mild motion residue
- Realistic direct-flash glare on skin, rails, and escalator surfaces
- Slight messiness in exposure and framing is allowed
- No HDR exaggeration
- No painterly blending
- No AI-smooth rendering
- Must feel like a real comedy-movie still, candid fashion snapshot, or accidental magazine outtake rather than a polished architectural editorial

REAL CAMERA IMPERFECTIONS (CONTROLLED):
- Slight direct-flash overexposure on parts of the face, hands, or nearby clothing
- Mild film grain
- Slight lens softness toward edges
- Tiny framing imperfection and handheld imbalance
- Slight motion blur in moving limbs or escalator tread texture
- Mild flash reflection on escalator rails
- No perfectly sterile gradients
- No unnaturally clean commercial finish

EXPOSURE & RESPONSE:
- Exposure should prioritize flash-lit subjects over balanced background rendering
- Subjects may appear brighter than the environment
- Background may fall slightly darker or dirtier in tone
- Highlights must roll off naturally in flash-lit skin and metal
- Midtones must preserve denim, cotton, and facial detail
- No flat global exposure balance
- No evenly polished mall-interior exposure

ANTI-AI CONSTRAINT:
- Do NOT use a distant top-down mall-architecture composition
- Do NOT center the image around perfectly intersecting escalators
- Do NOT make the pair look staged, posed, or overly composed
- Do NOT over-perfect faces or symmetry
- Do NOT clean up the direct-flash harshness
- Do NOT remove slight film grain, handheld imbalance, or candid awkwardness
- Do NOT invent readable extra people
- Maintain snapshot realism and accidental comedic energy

COLOR:
- Dominant palette:
  - dark navy and denim blues
  - muted black and charcoal
  - warm indoor beige ambient light
  - silver-gray escalator metal
- Flash-lit skin tones should feel slightly pale and immediate
- Overall color must feel like mixed indoor ambient light plus neutral flash
- No artificial color grading shifts
- No oversaturated chrome-mall palette
- No polished cool architectural grading

MOOD:
- Lively
- Humorous
- Spontaneous
- Slightly awkward
- Candid
- Playfully mischievous

STRICT RULES:
- Must use the uploaded images as the base, not generate new faces
- The final image must be built from the uploaded identities only
- Both uploaded identities must appear clearly and separately in the final image
- Preserve candid upward eye contact and caught-in-the-moment expressions
- The composition must match a close, high-angle, direct-flash escalator snapshot feeling
- Do NOT use the previous precise X-shaped escalator intersection structure
- Do NOT turn this into a polished architectural editorial
- Do not stylize or turn into fantasy imagery
- Do not over-perfect faces or symmetry
- Keep lighting, texture, motion, flash harshness, and atmosphere physically believable
- Do not obscure either face
- The uploaded faces must remain the identity source without exception

OUTPUT TARGET:
- Ultra-realistic candid escalator snapshot
- Exactly two primary Korean adults built from the two uploaded identities
- Both subjects riding the same escalator and twisting upward toward the camera
- Direct flash, visible film grain, slight motion softness, and handheld candid energy
- Modern indoor escalator environment with metallic rails and distant landing
- Looks like a real direct-flash comedy-film still or analog snapshot, not AI-generated`
  },
  "astronaut": {
    "default": `Use the uploaded image as the base and transform it, not generate a new person.

Transform the uploaded photo into a straight-on medium shot of a young Korean astronaut standing in front of a dark celestial backdrop scattered with shining stars.

This must look like a real high-resolution editorial photograph with a softly diffused, slightly milked, high-end digital finish — crisp but veiled, cool-toned, high-tech, and physically believable. Not fantasy art. Not stylized illustration. Not CGI. Real.

FACE — PRESERVE IDENTITY, INTEGRATE NATURALLY:
- Replace the subject’s face with the uploaded user’s face while preserving exact identity: face shape, bone structure, eye shape, nose, lips, jawline, proportions, and instantly recognizable likeness
- Maintain a calm, neutral, slightly serious expression unless minimal adjustment is required
- CRITICAL: The face must feel naturally integrated into the spacesuit and helmet environment — same lighting direction, same contrast, same skin texture, same visor tint, same reflection breakup, and same overall image sharpness
- The face must NOT look pasted, over-cleaned, or overly beautified
- The face must sit slightly deeper inside the helmet and read slightly dimmer than the bright exterior suit
- Match head, neck, and perspective seamlessly within the helmet opening
- Preserve real skin texture and facial structure, but allow subtle softening consistent with visor glass, optical diffusion, and premium editorial post-processing
- No structural beautification, no plastic skin, no artificial symmetry correction
- The final result must adapt naturally regardless of gender while preserving the same recognizable identity

FACE & CAMERA:
- Keep the subject instantly recognizable as the original user
- Maintain believable face proportions and natural structure
- The face must feel like a real photographed subject inside a helmet, not a composited beauty portrait
- The face must not fill the visor opening too perfectly; leave realistic dark space, glass thickness, and optical separation around it
- Reflection hotspots and visor glare must partially interrupt facial clarity in a physically believable way
- Capture using a professional full-frame digital / digital-cinema camera system
- Lens: 50mm standard prime (or 65mm cinema equivalent)
- Diffusion filter: 1/8 Black Pro-Mist or equivalent subtle diffusion filter
- Aperture: f/4–f/5.6 to keep the full helmet, suit structure, and star field crisp
- Shutter speed: ~1/125 sec
- ISO: 200–400
- White balance: 4300K–5000K
- Dynamic range: preserve bright suit whites while allowing the visor interior to sit slightly darker
- No digital over-sharpening; retain soft highlight bloom and natural optical falloff

HAIR:
- Natural hair mostly contained within the helmet
- Any visible hair must remain minimal, natural, and subdued
- No visible styling beyond what is realistically seen through the visor

CLOTHING:
- Thick, heavily insulated white astronaut spacesuit
- Prominent seams, reinforced paneling, and metallic fastenings
- Structured chest panels, harness-like straps, and rigid equipment modules
- Visible suit markings and printed text including “REPUBLIC OF KOREA” and a Korean flag patch
- Materials must feel physically real: layered fabric, composite components, subtle sheen, and realistic surface wear
- No artificial plastic look

POSE / COMPOSITION:
- Straight-on medium shot
- Subject centered at eye level
- Upright, neutral, grounded posture
- Medium framing with helmet, shoulders, chest unit, and upper torso clearly visible
- Strong negative space around the astronaut
- Composition must feel calm, frontal, and precise
- Slight asymmetry from visible suit-mounted equipment must remain

PROP / EQUIPMENT:
- Full astronaut helmet with glossy gold-tinted visor
- Visor must partially reflect the surrounding star field and lighting sources
- Backpack / life-support housing visible behind the shoulders
- Cylindrical side-mounted equipment visible near one side of the helmet
- Chest markings, printed text, and suit patches must remain legible but secondary
- Reflections must feel physical, not decorative

SCENE:
- Dark celestial backdrop with scattered silvery stars
- Deep black emptiness dominates the environment
- Stars must vary in size, brightness, and intensity
- Include a few brighter star blooms and many smaller points
- Background must feel open, mysterious, and minimal
- No fantasy nebula, no exaggerated cosmic elements

LIGHTING:
- Artificial, staged lighting emulating cosmic conditions
- Strong cool blue highlights defining the suit edges and contours
- Gentle white rim lighting separating the astronaut from the black background
- Low frontal fill maintaining subject readability without flattening the face
- The face inside the visor must remain slightly darker than the exterior suit
- Warm gold reflections and bright highlight hotspots must appear on the visor edges
- Soft specular reflections must appear on the visor and chest area
- No even beauty lighting, no flat frontal illumination

DEPTH & OPTICS:
- Moderate focal length with natural compression
- Full subject and star field remain in crisp focus
- No bokeh
- No visible distortion
- Micro-contrast slightly reduced by visor glass and diffusion filter
- Subtle halation around brighter stars and visor highlights
- Clean but not clinical optical rendering

PHOTO STYLE:
- High-resolution digital editorial photography
- Subtle post-processed enhancement for clarity and low-noise rendering
- Softly polished, pale highlight treatment across the suit and visor
- Slightly lowered micro-contrast and gentle bloom create the characteristic hazy, milky, retouched finish
- Facial detail must remain real but lightly veiled by glass, diffusion, and controlled post-processing
- No HDR exaggeration
- No hard-edged sharpening
- No plastic CGI finish
- Must feel like a real photographed image with tasteful premium retouching

REAL CAMERA IMPERFECTIONS (CONTROLLED):
- Slight visor reflections and mild internal contrast loss
- Mild highlight halation on bright stars and visor hotspots
- Tiny variation in star brightness, edge sharpness, and bloom
- Slight edge falloff and micro softness away from the center
- Minimal but non-zero sensor noise in the deepest blacks
- Subtle glass thickness, glare, and tiny surface imperfections on the visor
- No perfectly uniform clarity across every element

EXPOSURE & RESPONSE:
- Expose primarily for the white suit, allowing the face inside the visor to sit slightly lower in exposure
- Deep blacks must remain rich without heavy crushing
- White suit panels and reflective visor areas must have soft highlight roll-off
- Contrast must stay restrained and controlled
- Bright suit whites, cold blue highlights, and dim visor interior must coexist naturally
- No flat global exposure balance

ANTI-AI CONSTRAINT:
- Do NOT turn the face into a perfect beauty portrait
- Do NOT make the visor completely transparent, perfectly clean, or optically invisible
- Do NOT center the face too perfectly inside a generic helmet opening
- Do NOT produce uniform star spacing or wallpaper-like stars
- Do NOT make the suit surfaces plastic, glossy, or hyper-detailed
- Do NOT produce hyper-sharp skin, excessive symmetry, or cosmetic facial cleanup
- Maintain the soft, pale, slightly processed editorial finish of a real photographed image

COLOR:
- Dominant palette:
  - Crisp white
  - Metallic silver
  - Deep black
  - Cold blue highlights
- Secondary accent:
  - Warm gold visor reflections
- Maintain a cold, high-tech, otherworldly palette
- No warm overall shift
- No oversaturation

MOOD:
- Adventurous
- Awe-inspiring
- Futuristic
- Calm
- Mysterious
- Technologically confident

STRICT RULES:
- Must use the uploaded image identity as the base
- Must not generate a new face
- Preserve the gold-tinted visor, Korean flag / “REPUBLIC OF KOREA” markings, thick insulated suit, centered eye-level composition, black star field, and cool blue lighting
- Keep the face slightly recessed and slightly darker behind the visor
- Keep the soft, milky, slightly post-processed finish
- Do not stylize into fantasy sci-fi
- Keep all elements physically believable

OUTPUT TARGET:
- Ultra-realistic astronaut editorial portrait
- Same recognizable person inside a Korean-marked spacesuit
- Dark star field background
- Cool blue edge light, soft white rim light, warm visor reflections
- Soft, pale, slightly diffused processed finish matching a real photographed image
- Looks captured and retouched, not AI-generated`
  },
  "ramen-hair": {
    "default": `Use the uploaded image as the base and transform it, not generate a new person.

Transform the uploaded photo into a medium close-up portrait of a young Korean woman standing against a plain backdrop in soft, diffuse daylight, featuring exaggerated voluminous yellow curls styled like instant ramen noodles.

This must look like a real high-resolution editorial / social-media portrait photograph with a polished digital finish — absurdist, lighthearted, soft, and physically believable. Not fantasy art. Not stylized illustration. Not CGI. Real.

FACE — PRESERVE IDENTITY, INTEGRATE NATURALLY:
- Replace the subject’s face with the uploaded user’s face while preserving exact identity: face shape, bone structure, eye shape, nose, lips, jawline, proportions, and instantly recognizable likeness
- Maintain the same serious, straight-on, deadpan expression unless minimal adjustment is required
- CRITICAL: The face must feel naturally integrated into the hairstyle, clothing, and lighting environment — same lighting direction, same contrast, same skin texture, same frontal daylight behavior, and same overall image sharpness
- The face must NOT look pasted, over-cleaned, or overly beautified
- Match head, neck, posture, and perspective seamlessly into the portrait framing
- Preserve real skin texture, pores, slight tonal variation, and natural facial structure
- No structural beautification, no plastic skin, no artificial symmetry correction
- The final result must adapt naturally regardless of gender while preserving the same recognizable identity and the intended ramen-hair portrait concept

FACE & CAMERA:
- Keep the subject instantly recognizable as the original user
- Maintain believable face proportions and natural structure
- The face must feel like a real photographed portrait subject, not a composited beauty rendering
- The humorous effect must come from the contrast between the serious expression and the exaggerated hair, not from changing the facial identity
- Capture using a professional full-frame digital camera system
- Lens: 85mm portrait prime
- Aperture: f/3.2–f/4 to keep the face and hair sculpture sharp while producing soft background bokeh
- Shutter speed: ~1/160 sec
- ISO: 100–200
- White balance: neutral daylight, approx. 5000K–5600K
- Dynamic range: preserve skin detail and bright yellow hair detail without clipping
- No digital over-sharpening; retain soft portrait rendering and natural lens falloff

HAIR:
- Hair must change completely into exaggerated, voluminous yellow curls reminiscent of ramen noodles
- The hairstyle must mimic both the color and the spiral strand structure of classic instant noodle strands
- Curls must be meticulously defined, dense, springy, and highly textured
- Color must read as bright noodle-yellow with slight ochre warmth
- The hairstyle must feel like a real photographed hair sculpture / wig styling, not literal food placed on the head
- Preserve the humorous visual pun of “라면머리” / “면발헤어”
- No CGI noodle strands
- No fantasy hair glow
- No unrelated fashion-hair redesign

CLOTHING:
- Simple loose cotton t-shirt
- Plain neckline
- Casual, unremarkable fit
- Clothing must remain visually secondary to the hairstyle
- Fabric must feel real, soft, and everyday
- No embellishment, no statement styling, no fashion-catalog treatment

POSE / COMPOSITION:
- Medium close-up portrait
- Straight-on composition
- Subject centered in frame
- Upright standing posture
- Face and hair remain the clear focal point
- Composition must feel clean, direct, and intentionally minimal
- The plain background and simple shirt must support the hairstyle without competing with it

SCENE:
- Plain, neutral, uncluttered backdrop
- Softly out-of-focus background with no distracting objects
- Environment must feel minimal and editorial, with no set decoration
- The scene must remain simple so the ramen-hair concept reads immediately
- No props
- No extra styling elements beyond the subject, t-shirt, and background

LIGHTING:
- Soft, diffuse daylight
- Even frontal illumination
- Minimal harsh shadow
- Gentle wrap across the face and hair
- Bright yellow curls must remain clearly legible without blown highlights
- Lighting must feel natural and straightforward, not theatrical
- No dramatic spotlighting
- No heavy contrast lighting

DEPTH & OPTICS:
- Moderate portrait lens compression
- Soft background bokeh
- Face and hair sculpture remain sharp
- Background remains slightly softened and unobtrusive
- No distortion
- Clean optical rendering with natural falloff
- No exaggerated blur

PHOTO STYLE:
- High-resolution digital portrait photography
- Polished but physically believable editorial / social-media portrait finish
- Clean rendering with little visible noise
- Soft, modern digital clarity
- Slight surrealism must come from the hairstyle concept only
- No HDR exaggeration
- No painterly softness
- No AI-smooth rendering
- Must feel like a real photographed absurdist editorial portrait

REAL CAMERA IMPERFECTIONS (CONTROLLED):
- Slight natural lens falloff toward the edges
- Very mild softness outside the main focus plane
- Slight tonal inconsistency in the background to avoid a synthetic flat gradient
- Minimal but non-zero skin texture variation
- No perfectly uniform sharpness across every hair strand
- No sterile, over-clean rendering

EXPOSURE & RESPONSE:
- Balanced exposure centered on skin tone and bright yellow curls
- Soft highlight roll-off in the hair
- Gentle contrast with no crushed shadows
- Midtones must preserve most of the visual information
- The background must remain neutral and restrained
- No flat global overexposure

ANTI-AI CONSTRAINT:
- Do NOT turn the hair into literal noodles, food props, or CGI strands
- Do NOT produce plastic skin or beauty-campaign retouching
- Do NOT over-symmetrize the face
- Do NOT stylize the background
- Do NOT let the absurd concept become fantasy or cartoon imagery
- Maintain the effect as a real photographed portrait with a surreal hairstyle joke

COLOR:
- Dominant palette:
  - Muted earth tones
  - Ochre undertones
  - Bright noodle-yellow hair
  - Neutral subdued background
- The yellow hair must dominate visually
- The rest of the palette must remain restrained and understated
- No unnecessary saturation spikes outside the hair
- No heavy color grading

MOOD:
- Lighthearted
- Absurdist
- Playful
- Deadpan
- Slightly silly / “병맛”
- Polished but surreal

STRICT RULES:
- Must use the uploaded image identity as the base
- Must not generate a new face
- Preserve the serious straight-on expression
- Preserve the exaggerated ramen-noodle yellow curls as the main concept
- Keep the plain cotton t-shirt and plain uncluttered background
- Maintain soft diffuse daylight and medium close-up framing
- Do not stylize into cartoon, fantasy, or food-comedy CGI
- Keep all elements physically believable

OUTPUT TARGET:
- Ultra-realistic absurdist editorial portrait
- Same recognizable person
- Serious straight-on face with exaggerated yellow “라면머리 / 면발헤어”
- Plain t-shirt, plain background, soft daylight
- Clean polished digital portrait with soft bokeh
- Looks like a real photographed visual pun, not AI-generated`
  },
  "claw-machine": {
    "default": `Use the uploaded image as the base and transform it, not generate a new person.

Transform the uploaded photo into a straight-on, mid-range shot of a young Korean woman sitting curled up inside a classic arcade claw machine surrounded by plush dolls.

This must look like a real high-resolution editorial / lifestyle photograph — whimsical, nostalgic, playful, and physically believable. Not fantasy art. Not stylized illustration. Not CGI. Real.

FACE — PRESERVE IDENTITY, INTEGRATE NATURALLY:
- Replace the subject’s face with the uploaded user’s face while preserving exact identity: face shape, bone structure, eye shape, nose, lips, jawline, proportions, and instantly recognizable likeness
- Maintain a soft, neutral-to-gentle expression with subtle doll-like stillness unless minimal adjustment is required
- CRITICAL: The face must feel naturally integrated into the enclosed claw machine environment — same lighting direction, same contrast, same skin texture, same reflections through glass layers, and same overall image sharpness
- The face must NOT look pasted, over-cleaned, or artificially beautified
- Match head, neck, and curled body posture naturally within the confined space
- Preserve real skin texture and slight natural asymmetry
- No structural beautification, no plastic skin, no artificial symmetry correction
- The final result must adapt naturally regardless of gender while preserving the same recognizable identity

FACE & CAMERA:
- Keep the subject instantly recognizable as the original user
- Maintain believable face proportions and natural structure
- The face must feel like it is physically inside the machine behind glass, not composited
- Glass reflections and slight distortion must partially affect facial clarity
- Capture using a modern smartphone camera system
- Lens: standard smartphone lens (approx. 26mm–28mm equivalent)
- Aperture: f/1.8–f/2.2
- Shutter speed: ~1/120 sec
- ISO: 200–400
- White balance: mixed fluorescent + LED lighting (approx. 4000K–5000K)
- Dynamic range: preserve bright highlights from LEDs while retaining shadow detail
- No excessive sharpening; retain natural digital softness and highlight bloom

HAIR:
- Preserve the uploaded user’s natural hairstyle
- Hair must appear slightly compressed or shaped by the confined space
- No artificial restyling or exaggerated redesign

CLOTHING:
- Casual everyday outfit (unchanged from user image unless necessary)
- Fabric must appear natural with realistic folds from curled posture
- No costume-like styling
- Clothing remains secondary to the environment and plush elements

POSE / COMPOSITION:
- Straight-on mid-range shot
- Subject curled up inside the claw machine
- Knees drawn in, compact posture enhancing doll-like impression
- Centered composition within the rectangular frame of the machine
- Strong framing from the machine’s structure
- Subject visually surrounded and enclosed by plush toys

PROP:
- Arcade claw machine with transparent glass panels
- Visible smudges, fingerprints, and surface imperfections on glass
- Plush dolls filling the lower half of the frame:
  - pastel blue
  - pink
  - yellow
  - mint
- Plush toys must feel soft, varied, and densely packed
- Visible machine structure with red and blue painted metal frame
- Bold white Korean signage printed on the machine frame
- Internal claw mechanism may be partially visible

SCENE:
- Indoor arcade setting implied but not dominant
- Focus remains on the interior of the claw machine
- Background beyond glass remains secondary and slightly obscured
- Environment must feel nostalgic and familiar

LIGHTING:
- Overhead fluorescent lighting
- Internal LED illumination from the machine
- Cool-toned highlights with slight color variation
- Glossy reflections on glass and plastic surfaces
- Mild highlight blooming from bright LEDs
- Light must feel artificial and arcade-authentic
- No cinematic or studio lighting

DEPTH & OPTICS:
- Deep focus across subject and plush elements
- Multiple reflection layers due to glass surfaces
- Slight internal reflections overlapping subject and background
- No bokeh
- No distortion beyond natural glass and lens interaction
- Clean but layered optical rendering

PHOTO STYLE:
- High-resolution smartphone photography
- Clean digital clarity
- Slight highlight bloom from LED sources
- Subtle surface reflections and glare
- No HDR exaggeration
- No painterly softness
- No AI-smooth rendering
- Must feel like a real captured arcade moment

REAL CAMERA IMPERFECTIONS (CONTROLLED):
- Visible smudges and fingerprints on glass
- Slight glare and reflection layering
- Mild uneven exposure due to mixed light sources
- Subtle sensor noise in darker areas
- Slight loss of clarity through glass layers
- No perfectly clean or sterile surfaces

EXPOSURE & RESPONSE:
- Exposure balanced for subject and bright LED highlights
- Slight highlight bloom on bright surfaces
- Shadows remain soft but present within plush layers
- Midtones carry most visual detail
- No flat exposure

ANTI-AI CONSTRAINT:
- Do NOT produce perfectly clean glass
- Do NOT remove reflections or smudges
- Do NOT over-beautify the face
- Do NOT simplify plush arrangement
- Do NOT stylize into cartoon or toy-like rendering
- Maintain physical realism with layered reflections

COLOR:
- Dominant palette:
  - pastel blue
  - pink
  - yellow
  - mint
- Accents:
  - red and blue machine frame
  - white Korean text
- Cool highlights from LEDs
- Slight nostalgic color tone
- No oversaturation or artificial grading

MOOD:
- Whimsical
- Dreamlike
- Nostalgic
- Playful
- Slightly surreal but grounded
- Cute and enclosed

STRICT RULES:
- Must use the uploaded image identity as the base
- Must not generate a new face
- Preserve claw machine structure, glass reflections, plush toys, and Korean signage
- Maintain curled posture inside the machine
- Keep centered framing
- Maintain cool artificial lighting and LED highlights
- Do not stylize into fantasy or toy rendering
- Keep everything physically believable

OUTPUT TARGET:
- Ultra-realistic claw machine portrait
- Same recognizable person sitting inside the machine
- Surrounded by pastel plush dolls
- Visible reflections, smudges, and layered glass effects
- Cool LED lighting with slight bloom
- Looks like a real captured arcade scene, not AI-generated`
  },
  "boxing-counterpunch": {
    "default": `Use the uploaded image as the base and transform it, not generate a new person.

Transform the uploaded photo into a dramatic ultra-close side-angle boxing action portrait captured inside a boxing ring at the instant of a sharp counterpunch after a fast evasive upper-body movement.

This must look like a real high-resolution sports editorial photograph — tense, raw, competitive, and physically believable. Not fantasy art. Not stylized illustration. Not CGI. Real.

FACE — PRESERVE IDENTITY, INTEGRATE NATURALLY:
- Replace the subject’s face with the uploaded user’s face while preserving exact identity: face shape, bone structure, eye shape, nose, lips, jawline, proportions, and instantly recognizable likeness
- Maintain an intensely focused, adrenaline-driven expression with jaw slightly clenched unless minimal adjustment is required
- CRITICAL: The face must feel naturally integrated into the boxing-ring environment — same lighting direction, same contrast, same skin texture, same sweat behavior, and same overall image sharpness as the rest of the photograph
- The face must NOT look pasted, over-cleaned, or artificially beautified
- Match head angle, neck tension, motion direction, and perspective seamlessly into the action pose
- Preserve real skin texture, pores, slight asymmetry, and natural facial structure
- No structural beautification, no plastic skin, no artificial symmetry correction
- The final result must adapt naturally regardless of gender while preserving the same recognizable identity

FACE & CAMERA:
- Keep the subject instantly recognizable as the original user
- Maintain believable face proportions and natural structure
- The face must feel like a real photographed athlete under ring lighting, not a composited portrait
- Capture using a professional full-frame digital camera system
- Lens: 85mm portrait lens
- Aperture: f/1.8 to f/2.2 to create shallow depth of field and soft background separation
- Shutter speed: approximately 1/1000 to 1/1600 sec to freeze sweat and motion droplets
- ISO: 800 to 1600
- White balance: cool-neutral arena balance around 4300K to 5000K
- Dynamic range: preserve highlight detail on damp skin and gloves while retaining shadow structure
- No digital over-sharpening; maintain natural telephoto rendering, highlight roll-off, and subtle grain

HAIR:
- Preserve the uploaded user’s natural hairstyle
- Hair must react naturally to sweat, exertion, and motion
- Slight dampness and strand separation are allowed
- No unrelated restyling
- No artificial salon finish

CLOTHING:
- Standard boxing attire adapted naturally to the uploaded user’s gender while preserving real athletic practicality
- Heavy-duty boxing gloves
- Well-worn hand wraps
- Athletic ring-appropriate trunks or equivalent competition-ready boxing bottoms with realistic fabric texture
- All clothing must be functional, secure, and non-revealing
- Fabric must appear rough, matte, and physically believable
- Gloves must retain a slightly glossy finish with realistic wear
- No stylization, no costume exaggeration, no revealing wardrobe

POSE / COMPOSITION:
- Ultra-close side-angle action shot
- Subject captured moments after weaving the upper body to dodge a punch
- Subject delivering a sharp counterpunch
- Upper body tension and rotational movement must be clearly visible
- The rival appears only as a partially blurred opposing presence
- Composition must isolate the subject while preserving the immediate fight context
- Tight framing must emphasize face, glove, shoulder line, and impact direction

PROP / EQUIPMENT:
- Boxing ring ropes partially visible
- Heavy-duty gloves
- Hand wraps
- Rival’s blurred glove or partial facial presence may appear at the edge of frame
- Sweat beads and airborne droplets must be visible and physically believable
- No extra props outside the boxing environment

SCENE:
- Interior boxing ring
- Background elements reduced to soft blur
- Ring environment must remain legible through ropes, lighting, and spatial context
- Scene must feel like a professional fight or sparring setup
- No crowd detail required beyond implied arena atmosphere
- Environment must remain grounded and realistic

LIGHTING:
- Focused ring lighting
- Strong specular highlights on damp skin, hair, and gloves
- High-contrast directional light shaping the face and upper torso
- Cinematic but physically believable fight lighting
- No soft beauty lighting
- No stylized neon lighting
- Lighting must emphasize sweat, motion, and tension

DEPTH & OPTICS:
- Shallow depth of field
- Background rendered into soft, creamy bokeh
- Subject remains sharp with natural falloff
- Partial rival presence remains blurred
- Subtle telephoto compression from the 85mm lens
- No wide-angle distortion
- No artificial blur effects

PHOTO STYLE:
- High-resolution digital sports editorial photography
- Cinematic contrast
- Neutral grays, shadowy blues, and desaturated skin tones
- Natural grain texture consistent with high-end digital production
- No HDR exaggeration
- No painterly blending
- No AI-smooth rendering
- Must feel like a real captured boxing still from a premium sports photo shoot

REAL CAMERA IMPERFECTIONS (CONTROLLED):
- Slight natural grain in darker areas
- Tiny highlight bloom on sweat and glove reflections
- Mild motion residue on secondary background elements only
- No perfectly sterile gradients
- No unnaturally clean edge separation
- Maintain physical realism in droplets, skin texture, and lens rendering

EXPOSURE & RESPONSE:
- Exposure balanced for damp skin highlights and glove reflections
- Highlights must roll off naturally without harsh clipping
- Shadows must remain deep but readable
- Midtones must preserve skin texture, wraps, and fabric detail
- Contrast must feel strong and filmic without becoming artificial
- No flat global exposure balance

ANTI-AI CONSTRAINT:
- Do NOT beautify the face
- Do NOT over-clean skin or remove sweat texture
- Do NOT stylize droplets into decorative particles
- Do NOT turn the rival into a fully detailed second portrait
- Do NOT flatten lighting or reduce tension
- Do NOT make the wardrobe revealing, stylized, or costume-like
- Maintain raw, realistic athletic intensity

COLOR:
- Dominant palette:
  - neutral grays
  - shadowy blues
  - desaturated skin tones
- Controlled highlights on gloves, sweat, and ring lighting
- Palette must remain cinematic, restrained, and cool-neutral
- No oversaturation
- No artificial color grading shifts

MOOD:
- Tense
- Raw
- Competitive
- Focused
- Adrenaline-driven
- Intense and physically immediate

STRICT RULES:
- Must use the uploaded image identity as the base
- Must not generate a new face
- Preserve the ultra-close side angle, evasive movement, and counterpunch moment
- Maintain boxing ring context, sweat droplets, focused ring lighting, shallow depth of field, and rival blur
- Clothing must adapt automatically and naturally to the uploaded user’s gender while remaining realistic and non-revealing
- Remove any unnecessary suggestive styling or wording
- Do not stylize or clean the image
- Keep everything physically believable

OUTPUT TARGET:
- Ultra-realistic boxing action portrait
- Same recognizable person
- Intense side-angle counterpunch moment inside a boxing ring
- Focused ring lighting, sweat droplets, blurred rival presence, and creamy bokeh
- Gender-adaptive realistic boxing attire with non-revealing athletic styling
- Looks like a real high-end sports editorial still, not AI-generated`
  },
  "bronze-statue-bench": {
    "default": `Transform the uploaded photo into a realistic European-style park statue scene featuring a seated bronze human figure on an ornate metal bench, preserving the exact composition, pose, and environmental structure of the original image.

This must look like a real moderate-resolution digital photograph — natural, observational, and grounded in realism. Not stylized. Not cinematic. Not painterly. Real.

FACE — PRESERVE IDENTITY, INTEGRATE NATURALLY:
- Replace the statue's face with the uploaded user's face while preserving exact identity: face shape, bone structure, eye shape, nose, lips, jawline, proportions, and overall recognizability
- Maintain the same calm, slightly neutral expression consistent with the seated statue pose
- CRITICAL: The face must be fully integrated into the bronze material — including oxidized patina, subtle greenish verdigris, and metallic surface texture
- The face must NOT appear pasted; it must share identical reflectivity, roughness, and aging characteristics as the rest of the sculpture
- Preserve fine facial structure while adapting it into sculpted metal form
- No beautification, no smoothing, no symmetry correction
- Maintain believable depth and anatomical realism within the metallic transformation

HAIR:
- Preserve the user's real hairstyle but reinterpret it as sculpted bronze hair
- Hair must appear as cast metal with defined strands and structure, integrated into the statue
- Include subtle patina variation and natural oxidation across the surface
- No soft or natural hair rendering — must read as solid metal

CLOTHING:
- The figure must wear sculpted clothing as part of the statue: a loose shirt and long pants
- All garments must appear as cast bronze with visible folds, seams, and weight translated into metal form
- Include surface wear, slight smoothing on contact areas, and realistic casting imperfections
- No fabric simulation — everything must read as unified metallic material

POSE / COMPOSITION:
- Preserve the exact seated pose: the figure leaning slightly back on an ornate bench
- One arm resting casually along the backrest of the bench
- Legs extended forward with a relaxed posture
- Maintain straight-on perspective with slight angle from the front-left
- Medium-to-full body framing with the entire statue and bench visible
- Camera at approximately eye-level or slightly above, consistent with the original image
- Maintain natural spatial depth and subject placement within the frame

SCENE:
- Outdoor park setting with dry ground covered in fallen leaves and sparse grass
- Trees with green foliage overhead and around the scene
- Background includes a paved walkway and park infrastructure
- A white stone staircase and low wall structure visible in the background
- Green-painted metal railings and park elements present
- Ornate metal bench with intricate decorative patterns and cast iron detailing
- Ground surface includes stone pavement beneath the bench
- Environment must feel like a quiet, slightly worn public park

LIGHTING:
- Natural daylight under soft, diffused conditions
- Likely overcast or filtered sunlight through trees
- Soft shadows on the ground and under the bench
- Even illumination across statue and environment
- Subtle highlights on metallic surfaces of the statue and bench

DEPTH & OPTICS:
- Moderate depth of field with clear focus on the statue and foreground
- Background remains visible and readable with slight natural softness
- No motion blur
- No digital noise
- Natural smartphone or digital camera perspective

PHOTO STYLE:
- Moderate-resolution digital photography
- Clean, realistic rendering with balanced exposure
- No stylization, no HDR exaggeration
- No painterly or AI-generated artifacts
- Must feel like a casual but well-composed real-world photograph

COLOR:
- Natural, muted outdoor palette
- Bronze and dark metallic tones for statue and bench
- Earthy browns and tans in ground and fallen leaves
- Greens in foliage and park elements
- Off-white tones in stone structures
- No artificial saturation or color grading shifts

MOOD:
- Calm
- Still
- Quiet
- Slightly contemplative
- Reflective of a peaceful park moment with minimal human activity

STRICT RULES:
- Preserve the exact pose, bench structure, and seated positioning
- Maintain all environmental elements: trees, staircase, railings, pavement, and park layout
- Ensure full metallic realism of the statue with oxidation and patina
- Do not alter camera angle or framing
- Do not introduce stylization or remove details
- The user's identity must remain recognizable while fully integrated into the statue material

OUTPUT TARGET:
- A realistic park photograph featuring a seated bronze statue with the user's identity integrated into the sculptural form, resting on an ornate metal bench in a quiet outdoor setting, captured with natural light and authentic environmental detail, matching the original composition and atmosphere exactly.`
  },
};

// 레퍼런스 이미지 경로 배열 (public/ 기준)
// - 빈 배열 [] → 멀티모달 스킵 (텍스트 프롬프트만 사용)
// - 파일이 여러 개면 전부 Gemini에 전송 → 공통 스타일 추출
const STYLE_REFERENCES: Record<string, Record<string, string[]>> = {
  "voxel-character": { "default": [] },
  "flash-selfie":    { "default": [] },
  "joseon-farmer": {
    "v1": [],
    "v3": [],
    "v5": [],
  },
  "grab-selfie":     { "default": [] },
  "gyaru":           { "default": [] },
  "idol-photocard":  { "default": [] },
  "club-flash":      { "default": [] },
  "red-carpet-glam": { "default": [] },
  "dark-coquette":   { "default": [] },
  "datecam-film":    { "default": [] },
  "ulzzang-cam":     { "default": [] },
  "jjimjilbang-master": { "default": [] },
  "skydiving": { "default": [] },
  "maid-cafe-heart": { "default": [] },
  "hiphop-grillz": { "default": [] },
  "hellotokyo": { "default": [] },
  "mongolian-warrior": { "default": [], "tribal": [] },
  "american-rugby-player": { "default": [] },
  "american-cheerleader": { "default": [] },
  "western-gunslinger": { "default": [] },
  "drink-pov": { "default": [] },
  "existential-studio": { "default": [] },
  "transit-station-security": { "default": [] },
  "luxury-bedroom-bag": { "default": [] },
  "cinematic-horseback": { "default": [] },
  "dreamy-wildflower": { "default": [] },
  "dreamy-celebratory": { "default": [] },
  "bronze-statue-bench": { "default": [] },
  "orange-cosmic-girl": { "default": [], "flat-blue": [] },
  "subway-cctv": { "default": [] },
  "visual-kei": { "default": [] },
  "yakuza": { "default": [], "mafia": [] },
  // 천사 변신 — 레퍼런스 멀티모달 활성화
  "angel": {
    "dark": [
      "references/angel-dark-1.jpg",
      "references/angel-dark-2.jpg",
      "references/angel-dark-3.jpg",
      "references/angel-dark-4.jpg",
    ],
    "soft": [
      "references/angel-soft-1.jpg",
      "references/angel-soft-2.jpg",
      "references/angel-soft-3.jpg",
      "references/angel-soft-4.jpg",
    ],
  },
};

export async function POST(request: NextRequest) {
  const session = parseSession(request);
  const now = Date.now();
  let style = "";
  let imageBase64 = "";
  let imageBase64List: string[] = [];
  let mimeType = "image/jpeg";
  let variant = "default";

  try {
    const body = await request.json();
    style = body.style;
    imageBase64 = body.imageBase64 || "";
    imageBase64List = Array.isArray(body.imageBase64List)
      ? body.imageBase64List.filter((item: unknown): item is string => typeof item === "string" && item.length > 0)
      : [];
    mimeType = body.mimeType || "image/jpeg";
    variant = body.variant || "default";
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const inputImages = imageBase64List.length > 0 ? imageBase64List : (imageBase64 ? [imageBase64] : []);
  if (!style || inputImages.length === 0) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const stylePrompts = STYLE_PROMPTS[style];
  const prompt = stylePrompts?.[variant] ?? stylePrompts?.["default"];
  if (!prompt) {
    return NextResponse.json({ error: "Invalid style" }, { status: 400 });
  }

  const styleControl = (await loadStyleControlMap())[style];
  if (styleControl && (!styleControl.is_visible || !styleControl.is_enabled)) {
    return NextResponse.json(
      {
        error: styleControl.is_enabled
          ? "현재 숨김 처리된 카드예요."
          : "현재 점검 중인 카드예요. 잠시 후 다시 확인해주세요.",
      },
      { status: 403 }
    );
  }

  // ── 회원: 크레딧 차감 (원자적) ──────────────────────────────────────
  if (session) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
    const { data: newCredits, error: deductError } = await supabase.rpc("deduct_credit", {
      p_user_id: session.id,
    });
    if (deductError || newCredits === null || newCredits === undefined) {
      return NextResponse.json(
        { error: "크레딧이 없어요. 충전 후 이용해주세요!" },
        { status: 429 }
      );
    }
  }

  // ── 비회원: 쿠키 기반 1회 무료 체험 ──────────────────────────────────
  const raw = !session ? request.cookies.get(GUEST_COOKIE)?.value : undefined;
  const limitData = !session ? parseLimitCookie(raw) : null;
  let guestCount = 0;
  let resetAt = now + WINDOW_MS;
  if (!session && limitData && now < limitData.resetAt) {
    guestCount = limitData.count;
    resetAt = limitData.resetAt;
  }
  if (!session && guestCount >= GUEST_LIMIT) {
    return NextResponse.json(
      { error: "무료 체험이 끝났어요. 카카오 로그인하면 3크레딧을 무료로 받을 수 있어요!" },
      { status: 429 }
    );
  }

  const cookieValue = !session ? encodeLimitCookie({ count: guestCount + 1, resetAt }) : "";
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: Math.ceil((resetAt - now) / 1000),
  };

  try {
    // 레퍼런스 이미지 로드 (존재하는 파일만, 없으면 단일 이미지 모드 fallback)
    // 비용 절감을 위해 전체 리스트 중 랜덤하게 1개만 선택하여 보냄
    const refPaths = STYLE_REFERENCES[style]?.[variant] ?? STYLE_REFERENCES[style]?.["default"] ?? [];
    const chosenPath = refPaths.length > 0
      ? refPaths[Math.floor(Math.random() * refPaths.length)]
      : null;

    const loadedRefs: string[] = [];
    if (chosenPath) {
      try {
        const abs = path.join(process.cwd(), "public", chosenPath);
        console.log(`[ref] loading: ${abs}`);
        loadedRefs.push(fs.readFileSync(abs).toString("base64"));
        console.log(`[ref] loaded OK: ${chosenPath}`);
      } catch (e) {
        console.error(`[ref] load failed: ${chosenPath}`, e);
      }
    } else {
      console.log(`[ref] no ref — style=${style} variant=${variant}`);
    }

    const refCount = loadedRefs.length;
    const inputCount = inputImages.length;

    const promptText = refCount === 0
      ? (inputCount === 1
        ? `Edit this image: ${prompt}`
        : `Images 1 and 2 are uploaded source identities for a single combined edit. Use both uploaded people exactly as the only identity source and create one final image. Additional instructions: ${prompt}`)
      : (inputCount === 1
        ? `Image 1 is the original subject. Image 2 is the style reference. Extract identity from Image 1 and apply the exact style, color grading, and aesthetic of Image 2. Additional instructions: ${prompt}`
        : `Images 1 and 2 are uploaded source identities. Image ${inputCount + 1} is the style reference. Use the uploaded people as the only identity source and apply the exact style, color grading, and aesthetic of the style reference. Additional instructions: ${prompt}`);

    const contents = [
      ...inputImages.map((data) => ({ inlineData: { mimeType: mimeType || "image/jpeg", data } })),
      ...loadedRefs.map(b64 => ({ inlineData: { mimeType: "image/jpeg" as const, data: b64 } })),
      { text: promptText },
    ];

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

    const styleConfig = STYLE_CONFIGS[style];
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-image-preview",
      contents,
      config: {
        responseModalities: ["TEXT", "IMAGE"],
        ...(styleConfig && {
          temperature: styleConfig.temperature,
          topP: styleConfig.topP,
          topK: styleConfig.topK,
        }),
      },
    });

    const candidate = response.candidates?.[0];
    const finishReason = candidate?.finishReason;
    const parts = candidate?.content?.parts || [];

    // 이미지 없이 종료된 경우 원인 로그
    const textParts = parts.filter(p => p.text).map(p => p.text).join(" ");
    if (!parts.some(p => p.inlineData)) {
      console.error(`[generate] style=${style} finishReason=${finishReason} textResponse=${textParts || "(없음)"}`);
      await logGenerationError({
        styleId: style,
        variant,
        userId: session?.id,
        errorType: "no_image",
        finishReason: finishReason ?? null,
        message: textParts || "No image generated",
      });
    }

    for (const part of parts) {
      if (part.inlineData) {
        // Supabase 로깅 — 실패해도 이미지 응답에 영향 없음
        try {
          const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_KEY!
          );
          const { error } = await supabase.from("style_usage").insert({
            style_id: style,
            style_name: STYLE_LABELS[style] ?? style,
            user_id: session?.id ?? null,
            variant: variant ?? "default",
          });
          if (error) console.error("[Supabase] insert error:", error);

          if (session) {
            await supabase.from("user_events").insert({
              user_id: session.id,
              event_type: "transform",
              metadata: { style_id: style },
            });
          }
        } catch (err) {
          console.error("[Supabase] unexpected error:", err);
        }

        // 회원: clean 이미지 반환 (워터마크 없음)
        // 비회원: 워터마크 적용
        let imageData: string;
        if (session) {
          imageData = part.inlineData.data!;
        } else {
          imageData = await addWatermark(part.inlineData.data!);
        }

        const res = NextResponse.json({
          image: imageData,
          mimeType: "image/jpeg",
          shouldSaveHistory: !!session,
        });
        if (!session) res.cookies.set(GUEST_COOKIE, cookieValue, cookieOptions);
        return res;
      }
    }

    return NextResponse.json({ error: "No image generated" }, { status: 500 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[generate] catch error:", message);
    await logGenerationError({
      styleId: style || "unknown",
      variant,
      userId: session?.id,
      errorType: "exception",
      message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
