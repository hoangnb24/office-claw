import { AnimationClip, Object3D } from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinnedObject3D } from "three/examples/jsm/utils/SkeletonUtils.js";

export type AssetTelemetryEventName =
  | "load_start"
  | "load_progress"
  | "load_success"
  | "load_error"
  | "cache_hit";

export interface AssetTelemetryEvent {
  name: AssetTelemetryEventName;
  url: string;
  loadedBytes?: number;
  totalBytes?: number;
  durationMs?: number;
  error?: unknown;
}

export interface AssetManagerOptions {
  onTelemetryEvent?: (event: AssetTelemetryEvent) => void;
}

export interface ClonedAsset {
  url: string;
  root: Object3D;
  animations: AnimationClip[];
}

export class AssetManager {
  private readonly loader = new GLTFLoader();
  private readonly cache = new Map<string, Promise<GLTF>>();
  private readonly onTelemetryEvent?: (event: AssetTelemetryEvent) => void;

  constructor(options: AssetManagerOptions = {}) {
    this.onTelemetryEvent = options.onTelemetryEvent;
  }

  private emit(event: AssetTelemetryEvent): void {
    this.onTelemetryEvent?.(event);
  }

  async load(url: string): Promise<GLTF> {
    const cached = this.cache.get(url);
    if (cached) {
      this.emit({ name: "cache_hit", url });
      return cached;
    }

    const startedAt = performance.now();
    this.emit({ name: "load_start", url });

    const pendingLoad = new Promise<GLTF>((resolve, reject) => {
      this.loader.load(
        url,
        (gltf) => {
          this.emit({
            name: "load_success",
            url,
            durationMs: performance.now() - startedAt
          });
          resolve(gltf);
        },
        (progressEvent) => {
          this.emit({
            name: "load_progress",
            url,
            loadedBytes: progressEvent.loaded,
            totalBytes: progressEvent.total
          });
        },
        (error) => {
          this.cache.delete(url);
          this.emit({
            name: "load_error",
            url,
            durationMs: performance.now() - startedAt,
            error
          });
          reject(error);
        }
      );
    });

    this.cache.set(url, pendingLoad);
    return pendingLoad;
  }

  async clone(url: string): Promise<ClonedAsset> {
    const gltf = await this.load(url);

    // SkeletonUtils clone preserves skinned mesh/skeleton references correctly.
    const root = cloneSkinnedObject3D(gltf.scene) as Object3D;
    const animations = gltf.animations.map((clip) => clip.clone());

    return {
      url,
      root,
      animations
    };
  }

  clear(url?: string): void {
    if (url) {
      this.cache.delete(url);
      return;
    }
    this.cache.clear();
  }

  getCachedUrls(): string[] {
    return [...this.cache.keys()];
  }
}
