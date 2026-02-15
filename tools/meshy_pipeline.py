#!/usr/bin/env python3
"""
Meshy pipeline helper for OfficeClaw.

Flow:
1) Create image/multi-image-to-3d task from local reference image(s)
2) Poll task status until terminal
3) Download resulting GLB(s)
4) Optionally create rigging task and download rigged GLB
5) Optionally create animation tasks for action IDs and download each GLB

References:
- https://docs.meshy.ai/en/api/image-to-3d
- https://docs.meshy.ai/en/api/rigging-and-animation
"""

from __future__ import annotations

import argparse
import base64
import json
import mimetypes
import os
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import requests

API_BASE = "https://api.meshy.ai"
TERMINAL_STATUS = {"SUCCEEDED", "FAILED", "CANCELED"}


class MeshyError(RuntimeError):
    pass


def parse_action(value: str) -> Tuple[str, str]:
    if "=" not in value:
        raise argparse.ArgumentTypeError("Action mapping must be in ClipName=ActionId format")
    clip, action_id = value.split("=", 1)
    clip = clip.strip()
    action_id = action_id.strip()
    if not clip or not action_id:
        raise argparse.ArgumentTypeError("Invalid action mapping; both clip and action ID are required")
    return clip, action_id


def mime_for(path: Path) -> str:
    guessed, _ = mimetypes.guess_type(path.name)
    return guessed or "application/octet-stream"


def to_data_uri(path: Path) -> str:
    raw = path.read_bytes()
    encoded = base64.b64encode(raw).decode("ascii")
    return f"data:{mime_for(path)};base64,{encoded}"


def ensure_parent(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def http_json(
    *,
    session: requests.Session,
    method: str,
    url: str,
    payload: Optional[Dict[str, Any]] = None,
    timeout: int = 120,
) -> Dict[str, Any]:
    resp = session.request(method=method, url=url, json=payload, timeout=timeout)
    if resp.status_code >= 400:
        preview = resp.text[:600].strip()
        raise MeshyError(f"{method} {url} failed ({resp.status_code}): {preview}")
    try:
        return resp.json()
    except Exception as exc:  # pragma: no cover
        raise MeshyError(f"{method} {url} returned non-JSON response") from exc


def task_status(task: Dict[str, Any]) -> str:
    status = str(task.get("status", "")).strip().upper()
    return status


def task_progress(task: Dict[str, Any]) -> str:
    progress = task.get("progress")
    if progress is None:
        return "-"
    return str(progress)


def get_task_id(task: Dict[str, Any]) -> str:
    task_id = task.get("result") if isinstance(task.get("result"), str) else task.get("id")
    if not task_id:
        raise MeshyError(f"Task response missing id/result: {task}")
    return str(task_id)


def poll_task(
    *,
    session: requests.Session,
    url: str,
    interval_sec: float,
    timeout_sec: int,
    label: str,
) -> Dict[str, Any]:
    started = time.time()
    while True:
        task = http_json(session=session, method="GET", url=url)
        status = task_status(task)
        print(f"[{label}] status={status or '?'} progress={task_progress(task)}")
        if status in TERMINAL_STATUS:
            return task

        if time.time() - started > timeout_sec:
            raise MeshyError(f"{label} polling timed out after {timeout_sec}s")
        time.sleep(interval_sec)


def download_file(*, session: requests.Session, url: str, dest: Path) -> None:
    ensure_parent(dest)
    with session.get(url, timeout=300, stream=True) as resp:
        if resp.status_code >= 400:
            preview = resp.text[:600].strip()
            raise MeshyError(f"Download failed ({resp.status_code}) {url}: {preview}")
        with dest.open("wb") as f:
            for chunk in resp.iter_content(chunk_size=1024 * 256):
                if chunk:
                    f.write(chunk)


def create_generation_task(
    *,
    session: requests.Session,
    image_paths: List[Path],
    topology: str,
    should_texture: bool,
    ai_model: str,
) -> Tuple[str, str]:
    if len(image_paths) == 1:
        endpoint = "/openapi/v1/image-to-3d"
        payload: Dict[str, Any] = {
            "image_url": to_data_uri(image_paths[0]),
            "should_texture": should_texture,
            "topology": topology,
            "ai_model": ai_model,
        }
        label = "image-to-3d"
    else:
        endpoint = "/openapi/v1/multi-image-to-3d"
        payload = {
            "image_urls": [to_data_uri(p) for p in image_paths],
            "should_texture": should_texture,
            "topology": topology,
            "ai_model": ai_model,
        }
        label = "multi-image-to-3d"

    response = http_json(
        session=session,
        method="POST",
        url=f"{API_BASE}{endpoint}",
        payload=payload,
    )
    task_id = get_task_id(response)
    return endpoint, task_id


def create_rigging_task(
    *,
    session: requests.Session,
    generation_task_id: str,
    height_meters: float,
) -> str:
    endpoint = "/openapi/v1/rigging"
    payload = {"input_task_id": generation_task_id, "height_meters": height_meters}
    response = http_json(
        session=session,
        method="POST",
        url=f"{API_BASE}{endpoint}",
        payload=payload,
    )
    return get_task_id(response)


def create_animation_task(
    *,
    session: requests.Session,
    rigging_task_id: str,
    action_id: str,
) -> str:
    endpoint = "/openapi/v1/animations"
    payload = {"rigging_task_id": rigging_task_id, "action_id": action_id}
    response = http_json(
        session=session,
        method="POST",
        url=f"{API_BASE}{endpoint}",
        payload=payload,
    )
    return get_task_id(response)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate/download Meshy GLBs from image references.")
    parser.add_argument(
        "--image",
        action="append",
        required=True,
        help="Reference image path (repeatable). Use 1 image for image-to-3d, 2-4 for multi-image.",
    )
    parser.add_argument("--asset-id", required=True, help="Asset identifier prefix (example: agent1)")
    parser.add_argument("--output-dir", default="assets/glb", help="Output directory for downloaded GLBs")
    parser.add_argument(
        "--api-key-env",
        default="MESHY_API_KEY",
        help="Environment variable containing Meshy API key (default: MESHY_API_KEY)",
    )
    parser.add_argument(
        "--topology",
        choices=["triangle", "quad"],
        default="quad",
        help="Mesh topology for generation task",
    )
    parser.add_argument(
        "--ai-model",
        choices=["meshy-5", "meshy-4"],
        default="meshy-5",
        help="Meshy generation model",
    )
    parser.add_argument(
        "--no-texture",
        action="store_true",
        help="Disable texture generation during image-to-3d/multi-image-to-3d",
    )
    parser.add_argument("--poll-interval", type=float, default=10.0, help="Polling interval in seconds")
    parser.add_argument("--poll-timeout", type=int, default=3600, help="Polling timeout in seconds")
    parser.add_argument("--rig", action="store_true", help="Create rigging task after generation")
    parser.add_argument(
        "--height-meters",
        type=float,
        default=1.75,
        help="Height hint for rigging task",
    )
    parser.add_argument(
        "--action",
        action="append",
        type=parse_action,
        default=[],
        metavar="CLIP=ACTION_ID",
        help="Animation mapping (repeatable), requires --rig",
    )
    parser.add_argument(
        "--actions-json",
        default="",
        help="Optional JSON file with object mapping clip->action_id",
    )
    parser.add_argument(
        "--manifest-out",
        default="",
        help="Optional output JSON manifest for task IDs and downloaded files",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate inputs and print planned actions without calling Meshy API",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    image_paths = [Path(p).resolve() for p in args.image]
    missing_images = [str(p) for p in image_paths if not p.exists()]
    if missing_images:
        raise MeshyError(f"Missing image files: {missing_images}")
    if len(image_paths) > 4:
        raise MeshyError("Meshy multi-image-to-3d supports at most 4 images.")

    output_dir = Path(args.output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    action_map: Dict[str, str] = {}
    for clip, action_id in args.action:
        action_map[clip] = action_id
    if args.actions_json:
        actions_path = Path(args.actions_json).resolve()
        loaded = json.loads(actions_path.read_text(encoding="utf-8"))
        if not isinstance(loaded, dict):
            raise MeshyError("--actions-json must be a JSON object clip->action_id")
        for k, v in loaded.items():
            action_map[str(k)] = str(v)

    if action_map and not args.rig:
        raise MeshyError("--action/--actions-json requires --rig")

    api_key = os.getenv(args.api_key_env, "").strip()
    if not api_key:
        raise MeshyError(
            f"Missing API key. Set environment variable {args.api_key_env} with your Meshy bearer token."
        )

    if args.dry_run:
        print("Dry run summary:")
        print(f"- images: {[str(p) for p in image_paths]}")
        print(f"- asset_id: {args.asset_id}")
        print(f"- output_dir: {output_dir}")
        print(f"- generation_mode: {'image-to-3d' if len(image_paths) == 1 else 'multi-image-to-3d'}")
        print(f"- rigging: {args.rig}")
        print(f"- animation actions: {action_map if action_map else '(none)'}")
        print("- No Meshy API calls were made.")
        return 0

    manifest: Dict[str, Any] = {
        "asset_id": args.asset_id,
        "images": [str(p) for p in image_paths],
        "output_dir": str(output_dir),
        "tasks": {},
        "downloads": {},
    }

    session = requests.Session()
    session.headers.update({"Authorization": f"Bearer {api_key}"})

    print("Creating generation task...")
    generation_endpoint, generation_task_id = create_generation_task(
        session=session,
        image_paths=image_paths,
        topology=args.topology,
        should_texture=not args.no_texture,
        ai_model=args.ai_model,
    )
    manifest["tasks"]["generation"] = {
        "endpoint": generation_endpoint,
        "task_id": generation_task_id,
    }

    generation_task = poll_task(
        session=session,
        url=f"{API_BASE}{generation_endpoint}/{generation_task_id}",
        interval_sec=args.poll_interval,
        timeout_sec=args.poll_timeout,
        label="generation",
    )
    generation_status = task_status(generation_task)
    if generation_status != "SUCCEEDED":
        manifest["tasks"]["generation"]["result"] = generation_task
        raise MeshyError(f"Generation task ended with status {generation_status}")

    model_urls = generation_task.get("model_urls") or {}
    if not isinstance(model_urls, dict) or not model_urls.get("glb"):
        raise MeshyError("Generation succeeded but response has no model_urls.glb")

    base_glb_path = output_dir / f"{args.asset_id}_generated.glb"
    print(f"Downloading base GLB -> {base_glb_path}")
    download_file(session=session, url=str(model_urls["glb"]), dest=base_glb_path)
    manifest["downloads"]["generated_glb"] = str(base_glb_path)

    rigging_task: Optional[Dict[str, Any]] = None
    rigging_task_id: Optional[str] = None

    if args.rig:
        print("Creating rigging task...")
        rigging_task_id = create_rigging_task(
            session=session, generation_task_id=generation_task_id, height_meters=args.height_meters
        )
        manifest["tasks"]["rigging"] = {"task_id": rigging_task_id}

        rigging_task = poll_task(
            session=session,
            url=f"{API_BASE}/openapi/v1/rigging/{rigging_task_id}",
            interval_sec=args.poll_interval,
            timeout_sec=args.poll_timeout,
            label="rigging",
        )
        rigging_status = task_status(rigging_task)
        if rigging_status != "SUCCEEDED":
            manifest["tasks"]["rigging"]["result"] = rigging_task
            raise MeshyError(f"Rigging task ended with status {rigging_status}")

        rig_glb_url = rigging_task.get("rigged_character_glb_url")
        if rig_glb_url:
            rigged_glb_path = output_dir / f"{args.asset_id}_rigged.glb"
            print(f"Downloading rigged GLB -> {rigged_glb_path}")
            download_file(session=session, url=str(rig_glb_url), dest=rigged_glb_path)
            manifest["downloads"]["rigged_glb"] = str(rigged_glb_path)

    if action_map:
        if not rigging_task_id:
            raise MeshyError("Internal error: missing rigging task ID for animation calls")
        manifest["tasks"]["animations"] = {}
        manifest["downloads"]["animations"] = {}

        for clip_name, action_id in action_map.items():
            print(f"Creating animation task for {clip_name} (action_id={action_id})...")
            anim_task_id = create_animation_task(
                session=session, rigging_task_id=rigging_task_id, action_id=action_id
            )
            manifest["tasks"]["animations"][clip_name] = {"action_id": action_id, "task_id": anim_task_id}

            anim_task = poll_task(
                session=session,
                url=f"{API_BASE}/openapi/v1/animations/{anim_task_id}",
                interval_sec=args.poll_interval,
                timeout_sec=args.poll_timeout,
                label=f"animation:{clip_name}",
            )
            anim_status = task_status(anim_task)
            if anim_status != "SUCCEEDED":
                manifest["tasks"]["animations"][clip_name]["result"] = anim_task
                raise MeshyError(f"Animation task for {clip_name} ended with status {anim_status}")

            anim_glb_url = anim_task.get("animation_glb_url")
            if not anim_glb_url:
                raise MeshyError(f"Animation task for {clip_name} succeeded but animation_glb_url missing")

            clip_safe = "".join(ch if ch.isalnum() or ch in ("-", "_") else "_" for ch in clip_name)
            anim_dest = output_dir / f"{args.asset_id}_{clip_safe}.glb"
            print(f"Downloading animation GLB [{clip_name}] -> {anim_dest}")
            download_file(session=session, url=str(anim_glb_url), dest=anim_dest)
            manifest["downloads"]["animations"][clip_name] = str(anim_dest)

    if args.manifest_out:
        manifest_out = Path(args.manifest_out).resolve()
        ensure_parent(manifest_out)
        manifest_out.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
        print(f"Wrote manifest: {manifest_out}")

    print("Meshy pipeline completed successfully.")
    print("Note: Meshy API assets have limited retention; keep downloaded files in source control/artifact storage.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except MeshyError as exc:
        print(f"ERROR: {exc}")
        raise SystemExit(1)
