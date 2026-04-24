import { MAX_THREADS_IMAGE_COUNT, parseThreadsImageUrls } from "@/lib/threads-images";

const BASE = "https://graph.threads.net/v1.0";
const USER_ID = process.env.THREADS_USER_ID!;
const ACCESS_TOKEN = process.env.THREADS_ACCESS_TOKEN!;

export type ThreadsPostResult =
  | { ok: true; threadId: string }
  | { ok: false; error: string };

async function createThreadsContainer(body: Record<string, string | boolean>) {
  const res = await fetch(`${BASE}/${USER_ID}/threads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...body,
      access_token: ACCESS_TOKEN,
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.id) {
    throw new Error(JSON.stringify(data));
  }

  return String(data.id);
}

export async function publishToThreads(
  content: string,
  imageUrlOrUrls?: string | string[] | null
): Promise<ThreadsPostResult> {
  try {
    const imageUrls = parseThreadsImageUrls(imageUrlOrUrls);
    if (imageUrls.length > MAX_THREADS_IMAGE_COUNT) {
      return { ok: false, error: `Too many images. Threads supports up to ${MAX_THREADS_IMAGE_COUNT} images.` };
    }

    let creationId = "";

    if (imageUrls.length === 0) {
      creationId = await createThreadsContainer({
        media_type: "TEXT",
        text: content,
      });
    } else if (imageUrls.length === 1) {
      creationId = await createThreadsContainer({
        media_type: "IMAGE",
        image_url: imageUrls[0],
        text: content,
      });
    } else {
      const children = await Promise.all(
        imageUrls.map((imageUrl) =>
          createThreadsContainer({
            media_type: "IMAGE",
            image_url: imageUrl,
            is_carousel_item: true,
          })
        )
      );

      creationId = await createThreadsContainer({
        media_type: "CAROUSEL",
        children: children.join(","),
        text: content,
      });
    }

    // Step 2: publish container
    const publishRes = await fetch(`${BASE}/${USER_ID}/threads_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creation_id: creationId, access_token: ACCESS_TOKEN }),
    });
    const publishData = await publishRes.json();
    if (!publishRes.ok || !publishData.id) {
      return { ok: false, error: JSON.stringify(publishData) };
    }

    return { ok: true, threadId: publishData.id };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
