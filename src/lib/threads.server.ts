import { MAX_THREADS_IMAGE_COUNT, parseThreadsImageUrls } from "@/lib/threads-images";

const BASE = "https://graph.threads.net/v1.0";
const USER_ID = process.env.THREADS_USER_ID!;
const ACCESS_TOKEN = process.env.THREADS_ACCESS_TOKEN!;
const CONTAINER_POLL_INTERVAL_MS = 5000;
const CONTAINER_MAX_WAIT_MS = 60000;
const CAROUSEL_PROPAGATION_DELAY_MS = 10000;

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
    fields: "id,status,error_message",
    access_token: ACCESS_TOKEN,
  });
  const res = await fetch(`${BASE}/${containerId}?${params.toString()}`, { cache: "no-store" });
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(formatThreadsError(data));
  }

  const status = typeof data?.status === "string" ? data.status : null;
  const errorMessage = typeof data?.error_message === "string" ? data.error_message : null;
  return { status, errorMessage };
}

async function waitForThreadsContainer(container: ThreadsContainer, label: string) {
  const startedAt = Date.now();
  let lastStatus = "UNKNOWN";

  while (Date.now() - startedAt <= CONTAINER_MAX_WAIT_MS) {
    const result = await getThreadsContainerStatus(container.id).catch((error) => {
      lastStatus = String(error);
      return null;
    });

    const status = result?.status ?? null;
    if (status) lastStatus = status;
    if (status === "FINISHED" || status === "PUBLISHED") return;
    if (status === "ERROR" || status === "EXPIRED") {
      const detail = result?.errorMessage ? ` ${result.errorMessage}` : "";
      throw new Error(`${label} container ${container.id} is ${status}.${detail}`);
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

async function createReadyCarouselContainer(imageUrls: string[], content: string) {
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
  await sleep(CAROUSEL_PROPAGATION_DELAY_MS);

  const carousel = await createCarouselContainerWithRetry(children, content);
  await waitForThreadsContainer(carousel, "carousel");
  await sleep(CAROUSEL_PROPAGATION_DELAY_MS);

  return carousel;
}

async function publishThreadsContainer(creationId: string) {
  const publishRes = await fetch(`${BASE}/${USER_ID}/threads_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: creationId, access_token: ACCESS_TOKEN }),
  });
  const publishData = await publishRes.json();
  if (!publishRes.ok || !publishData.id) {
    return { ok: false as const, error: formatThreadsError(publishData) };
  }

  return { ok: true as const, threadId: String(publishData.id) };
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
      const carousel = await createReadyCarouselContainer(imageUrls, content);
      creationId = carousel.id;
    }

    const publishResult = await publishThreadsContainer(creationId);
    if (publishResult.ok) {
      return { ok: true, threadId: publishResult.threadId };
    }

    if (imageUrls.length > 1 && publishResult.error.includes("Invalid Carousel Children")) {
      const retryCarousel = await createReadyCarouselContainer(imageUrls, content);
      const retryResult = await publishThreadsContainer(retryCarousel.id);
      if (retryResult.ok) {
        return { ok: true, threadId: retryResult.threadId };
      }
      return { ok: false, error: retryResult.error };
    }

    return { ok: false, error: publishResult.error };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
