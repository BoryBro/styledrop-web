const BASE = "https://graph.threads.net/v1.0";
const USER_ID = process.env.THREADS_USER_ID!;
const ACCESS_TOKEN = process.env.THREADS_ACCESS_TOKEN!;

export type ThreadsPostResult =
  | { ok: true; threadId: string }
  | { ok: false; error: string };

export async function publishToThreads(
  content: string,
  imageUrl?: string | null
): Promise<ThreadsPostResult> {
  try {
    // Step 1: create container
    const containerBody: Record<string, string> = {
      text: content,
      access_token: ACCESS_TOKEN,
    };
    if (imageUrl) {
      containerBody.media_type = "IMAGE";
      containerBody.image_url = imageUrl;
    } else {
      containerBody.media_type = "TEXT";
    }

    const containerRes = await fetch(`${BASE}/${USER_ID}/threads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(containerBody),
    });
    const containerData = await containerRes.json();
    if (!containerRes.ok || !containerData.id) {
      return { ok: false, error: JSON.stringify(containerData) };
    }

    // Step 2: publish container
    const publishRes = await fetch(`${BASE}/${USER_ID}/threads_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creation_id: containerData.id, access_token: ACCESS_TOKEN }),
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
