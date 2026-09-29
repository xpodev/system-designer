"""
SAVE storage server — the A/M "executor" side of packages/transport's
HttpStorageTransport. It doesn't know anything about Layer/Language/Entity
shapes; it just persists whatever JSON document the client sends for a
project, and serves a small virtual file store. Modeling the AST server-side
for a headless validation pipeline is future work (spec 6.1's "Headless
Validation AST Pipeline"), not needed for this transport to work end to end.
"""

import asyncio
import json
import os
from pathlib import Path
from typing import Any, Dict, Set

import aiofiles
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel

app = FastAPI(title="SAVE Storage Server", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

WORKSPACE_DIR = Path(os.getenv("SAVE_WORKSPACE", "./workspace")).resolve()
PROJECTS_DIR = WORKSPACE_DIR / ".save"


def ensure_dirs() -> None:
    WORKSPACE_DIR.mkdir(parents=True, exist_ok=True)
    PROJECTS_DIR.mkdir(parents=True, exist_ok=True)


class FileWritePayload(BaseModel):
    path: str
    content: str


def safe_path(path: str) -> Path:
    """Resolves `path` under WORKSPACE_DIR and refuses anything that would
    escape it (e.g. `../../etc/passwd`) — the one thing the spec's own
    sketch left unchecked."""
    full_path = (WORKSPACE_DIR / path).resolve()
    if WORKSPACE_DIR not in full_path.parents and full_path != WORKSPACE_DIR:
        raise HTTPException(status_code=400, detail="Path escapes workspace")
    return full_path


@app.get("/api/v1/health")
async def health() -> Dict[str, Any]:
    return {"status": "ok", "workspace": str(WORKSPACE_DIR)}


@app.get("/api/v1/projects/{project_id}")
async def get_project(project_id: str) -> Dict[str, Any]:
    ensure_dirs()
    path = PROJECTS_DIR / f"{project_id}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Project not found")
    async with aiofiles.open(path, mode="r") as f:
        return json.loads(await f.read())


@app.put("/api/v1/projects/{project_id}")
async def put_project(project_id: str, payload: Dict[str, Any]) -> Dict[str, str]:
    ensure_dirs()
    path = PROJECTS_DIR / f"{project_id}.json"
    async with aiofiles.open(path, mode="w") as f:
        await f.write(json.dumps(payload, indent=2))
    return {"status": "success"}


@app.get("/api/v1/fs/list")
async def list_files(path: str = "") -> list[str]:
    ensure_dirs()
    base = safe_path(path)
    if not base.exists():
        return []
    results = []
    for root, _dirs, files in os.walk(base):
        for name in files:
            full = Path(root) / name
            results.append(str(full.relative_to(WORKSPACE_DIR)).replace("\\", "/"))
    return results


@app.get("/api/v1/fs/read", response_class=PlainTextResponse)
async def read_file(path: str) -> str:
    full_path = safe_path(path)
    if not full_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    async with aiofiles.open(full_path, mode="r") as f:
        return await f.read()


@app.post("/api/v1/fs/write")
async def write_file(payload: FileWritePayload) -> Dict[str, str]:
    full_path = safe_path(payload.path)
    full_path.parent.mkdir(parents=True, exist_ok=True)
    async with aiofiles.open(full_path, mode="w") as f:
        await f.write(payload.content)
    await broadcast_change(payload.path, payload.content)
    return {"status": "success"}


# --- File watching over WebSocket ---
# A polling watcher rather than a native FS-event API: no extra dependency,
# and workable identically on every platform the editor targets.

_clients: Set[WebSocket] = set()
_mtimes: Dict[str, float] = {}
_watch_interval_s = 1.0


async def broadcast_change(path: str, content: str) -> None:
    if not _clients:
        return
    message = json.dumps({"path": path, "content": content, "updatedAt": int(asyncio.get_event_loop().time() * 1000)})
    dead: Set[WebSocket] = set()
    for client in _clients:
        try:
            await client.send_text(message)
        except Exception:
            dead.add(client)
    _clients.difference_update(dead)


async def poll_workspace() -> None:
    ensure_dirs()
    while True:
        await asyncio.sleep(_watch_interval_s)
        if not _clients:
            continue
        for root, _dirs, files in os.walk(WORKSPACE_DIR):
            for name in files:
                full = Path(root) / name
                rel = str(full.relative_to(WORKSPACE_DIR)).replace("\\", "/")
                try:
                    mtime = full.stat().st_mtime
                except OSError:
                    continue
                if _mtimes.get(rel) != mtime:
                    _mtimes[rel] = mtime
                    try:
                        async with aiofiles.open(full, mode="r") as f:
                            content = await f.read()
                        await broadcast_change(rel, content)
                    except (OSError, UnicodeDecodeError):
                        continue


@app.on_event("startup")
async def on_startup() -> None:
    ensure_dirs()
    asyncio.create_task(poll_workspace())


@app.websocket("/api/v1/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await websocket.accept()
    _clients.add(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        _clients.discard(websocket)
