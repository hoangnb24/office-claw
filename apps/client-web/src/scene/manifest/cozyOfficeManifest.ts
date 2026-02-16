import cozyOfficeManifestJson from "../../../../../assets/scenes/cozy_office_v0.scene.json";
import { parseSceneManifest, type SceneManifest } from "../loader";

// Canonical scene manifest source for in-client nav/focus/highlight metadata.
export const cozyOfficeManifest: SceneManifest = parseSceneManifest(cozyOfficeManifestJson);
