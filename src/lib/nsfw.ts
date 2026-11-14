"use client";
// On-device nudity screening. The model (MobileNetV2, ~3.5 MB) is downloaded
// only when someone attaches media, runs entirely in the browser, and costs
// nothing per image. Videos are screened by sampling frames.
type Model = { classify: (el: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement) => Promise<{ className: string; probability: number }[]> };
let modelPromise: Promise<Model> | null = null;

function loadModel(): Promise<Model> {
  return (modelPromise ??= (async () => {
    await import("@tensorflow/tfjs");
    const [core, def] = await Promise.all([import("nsfwjs/core"), import("nsfwjs/models/mobilenet_v2")]);
    return (await core.load("MobileNetV2", { modelDefinitions: [def.MobileNetV2Model] })) as unknown as Model;
  })().catch((e) => { modelPromise = null; throw e; }));
}

export type Screen = { ok: boolean; checked: boolean; reason?: string };

function unsafe(preds: { className: string; probability: number }[]) {
  const p = Object.fromEntries(preds.map((x) => [x.className, x.probability]));
  return (p.Porn || 0) + (p.Hentai || 0) > 0.55 || (p.Sexy || 0) > 0.8;
}

const once = (el: HTMLElement, ok: string, ms = 15000) =>
  new Promise<void>((res, rej) => {
    const t = setTimeout(() => rej(new Error("timeout")), ms);
    el.addEventListener(ok, () => { clearTimeout(t); res(); }, { once: true });
    el.addEventListener("error", () => { clearTimeout(t); rej(new Error("decode")); }, { once: true });
  });

export async function screenFile(file: File): Promise<Screen> {
  const url = URL.createObjectURL(file);
  try {
    const model = await loadModel();
    if (file.type.startsWith("video/")) {
      const v = document.createElement("video");
      v.muted = true; v.playsInline = true; v.preload = "auto"; v.src = url;
      await once(v, "loadeddata");
      const dur = isFinite(v.duration) && v.duration > 0 ? v.duration : 1;
      for (const f of [0.1, 0.3, 0.5, 0.7, 0.9]) {
        v.currentTime = dur * f;
        await once(v, "seeked");
        if (unsafe(await model.classify(v))) return { ok: false, checked: true, reason: "This video appears to contain nudity or sexual content, which is not allowed." };
      }
      return { ok: true, checked: true };
    }
    const img = new Image();
    img.src = url;
    await once(img, "load");
    if (unsafe(await model.classify(img))) return { ok: false, checked: true, reason: "This image appears to contain nudity or sexual content, which is not allowed." };
    return { ok: true, checked: true };
  } catch {
    // Could not screen on this device: allow the upload but send the post to human review.
    return { ok: true, checked: false };
  } finally {
    URL.revokeObjectURL(url);
  }
}
