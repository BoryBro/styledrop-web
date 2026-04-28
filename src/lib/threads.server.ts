import { MAX_THREADS_IMAGE_COUNT, parseThreadsImageUrls } from "@/lib/threads-images";

const BASE = "https://graph.threads.net/v1.0";
const USER_ID = process.env.THREADS_USER_ID!;
const ACCESS_TOKEN = process.env.THREADS_ACCESS_TOKEN!;
const CONTAINER_POLL_INTERVAL_MS = 2500;
const CONTAINER_MAX_WAIT_MS = 60000;

export type ThreadsPostResult =
  | { ok: true; threadId: string }
  | { ok: false; error: string };

type ThreadsContainer = {
  id: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatThreadsError(data: unknown) {
  if (data && typeof data === "object" && "error" in data) {
    const error = (data as { error?: Record<string, unknown> }).error;
    const title = typeof error?.error_user_title === "string" ? error.error_user_title : null;
    const msg = typeof error?.error_user_msg === "string" ? error.error_user_msg : null;
    const message = typeof error?.message === "string" ? error.message : null;
    if (title && msg) return `${title}: ${msg}`;
    if (msg) return msg;
    if (message) return message;
  }
  return JSON.stringify(data);
}

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
    throw new Error(formatThreadsError(data));
  }

  return { id: String(data.id) };
}

async function getThreadsContainerStatus(containerId: string) {
  const params = new URLSearchParams({
    fields: "status_code",
    access_token: ACCESS_TOKEN,
  });
  const res = await fetch(`${BASE}/${containerId}?${params.toString()}`, { cache: "no-store" });
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(formatThreadsError(data));
  }

  return typeof data?.status_code === "string" ? data.status_code : null;
}

async function waitForThreadsContainer(container: ThreadsContainer, label: string) {
  const startedAt = Date.now();
  let lastStatus = "UNKNOWN";

  while (Date.now() - startedAt <= CONTAINER_MAX_WAIT_MS) {
    const status = await getThreadsContainerStatus(container.id).catch((error) => {
      lastStatus = String(error);
      return null;
    });

    if (status) lastStatus = status;
    if (status === "FINISHED" || status === "PUBLISHED") return;
    if (status === "ERROR" || status === "EXPIRED") {
      throw new Error(`${label} container ${container.id} is ${status}.`);
    }

    await sleep(CONTAINER_POLL_INTERVAL_MS);
  }

  throw new Error(`${label} container ${container.id} was not ready. Last status: ${lastStatus}`);
}

async function createCarouselContainerWithRetry(children: ThreadsContainer[], content: string) {
  const body = {
    media_type: "CAROUSEL",
    children: children.map((child) => child.id).join(","),
    text: content,
  };

  try {
    return await createThreadsContainer(body);
  } catch (error) {
    const message = String(error);
    if (!message.includes("Invalid Carousel Children")) throw error;

    await Promise.all(children.map((child, index) => waitForThreadsContainer(child, `carousel child ${index + 1}`)));
    await sleep(CONTAINER_POLL_INTERVAL_MS * 2);
    return createThreadsContainer(body);
  }
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
      const container = await createThreadsContainer({
        media_type: "TEXT",
        text: content,
      });
      creationId = container.id;
    } else if (imageUrls.length === 1) {
      const container = await createThreadsContainer({
        media_type: "IMAGE",
        image_url: imageUrls[0],
        text: content,
      });
      await waitForThreadsContainer(container, "image");
      creationId = container.id;
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

      await Promise.all(children.map((child, index) => waitForThreadsContainer(child, `carousel child ${index + 1}`)));

      const carousel = await createCarouselContainerWithRetry(children, content);
      await waitForThreadsContainer(carousel, "carousel");
      creationId = carousel.id;
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
