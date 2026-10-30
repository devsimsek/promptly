// Browser-cache maintenance for downloaded model files. Transformers.js
// stores model/tokenizer/runtime assets in the Cache API under
// transformers-related names; clearing frees the storage without touching
// scripts or settings.

const CACHE_NAME_PATTERN = /(transformers|onnx|onnxruntime|huggingface)/i;

export async function clearModelCaches() {
  if (typeof caches === "undefined") return null; // insecure origin
  const names = await caches.keys();
  const targets = names.filter((name) => CACHE_NAME_PATTERN.test(name));
  await Promise.all(targets.map((name) => caches.delete(name)));
  return targets.length;
}

export async function modelCacheNames() {
  if (typeof caches === "undefined") return [];
  const names = await caches.keys();
  return names.filter((name) => CACHE_NAME_PATTERN.test(name));
}
