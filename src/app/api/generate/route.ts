import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { addWatermark } from "@/lib/watermark";
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
    const { style, imageBase64, mimeType, variant = "default" } = await request.json();

    const stylePrompts = STYLE_PROMPTS[style];
    const prompt = stylePrompts?.[variant] ?? stylePrompts?.["default"];
    if (!prompt) {
      return NextResponse.json({ error: "Invalid style" }, { status: 400 });
    }

    // ── 로컬 Mock 모드 (MOCK_GEMINI=true 시 API 호출 없이 입력 이미지 그대로 반환) ──
    if (process.env.MOCK_GEMINI === "true") {
      console.log(`[MOCK] style=${style} variant=${variant} — Gemini API 호출 생략`);
      const res = NextResponse.json({
        image: imageBase64,
        mimeType: mimeType || "image/jpeg",
        shouldSaveHistory: false,
      });
      if (!session) res.cookies.set(GUEST_COOKIE, cookieValue, cookieOptions);
      return res;
    }

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

    const promptText = refCount === 0
      ? `Edit this image: ${prompt}`
      : `Image 1 is the original subject. Image 2 is the style reference. Extract identity from Image 1 and apply the exact style, color grading, and aesthetic of Image 2. Additional instructions: ${prompt}`;

    const contents = [
      { inlineData: { mimeType: mimeType || "image/jpeg", data: imageBase64 } },
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
    if (!parts.some(p => p.inlineData)) {
      const textParts = parts.filter(p => p.text).map(p => p.text).join(" ");
      console.error(`[generate] style=${style} finishReason=${finishReason} textResponse=${textParts || "(없음)"}`);
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
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
