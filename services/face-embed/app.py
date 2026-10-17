"""
HeresNow face embedding sidecar — InsightFace buffalo_l (512-d).

Run (local):
  pip install -r requirements.txt
  uvicorn app:app --host 0.0.0.0 --port 8090

Env:
  FACE_EMBED_SERVICE_SECRET  optional Bearer token
"""

from __future__ import annotations

import base64
import os
import re
from typing import Any

import cv2
import numpy as np
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

MODEL_NAME = "insightface-buffalo_l"
_app_face = None

app = FastAPI(title="HeresNow Face Embed", version="1.0.0")


def _require_auth(authorization: str | None) -> None:
    secret = os.environ.get("FACE_EMBED_SERVICE_SECRET", "").strip()
    if not secret:
        return
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="UNAUTHORIZED")
    if authorization.removeprefix("Bearer ").strip() != secret:
        raise HTTPException(status_code=401, detail="UNAUTHORIZED")


def get_face_app():
    global _app_face
    if _app_face is not None:
        return _app_face
    from insightface.app import FaceAnalysis

    providers = ["CUDAExecutionProvider", "CPUExecutionProvider"]
    fa = FaceAnalysis(name="buffalo_l", providers=providers)
    fa.prepare(ctx_id=0, det_size=(640, 640))
    _app_face = fa
    return fa


def decode_image(image: str) -> np.ndarray:
    raw = image.strip()
    m = re.match(r"^data:image/[^;]+;base64,(.+)$", raw, re.I | re.S)
    b64 = m.group(1) if m else raw
    try:
        buf = base64.b64decode(b64, validate=False)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"INVALID_BASE64:{e}") from e
    arr = np.frombuffer(buf, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(status_code=400, detail="INVALID_IMAGE")
    return img


class EmbedBody(BaseModel):
    image: str = Field(..., min_length=32)


class EmbedResponse(BaseModel):
    embedding: list[float]
    model: str
    dim: int
    detection_score: float


@app.get("/health")
def health() -> dict[str, Any]:
    return {"ok": True, "model": MODEL_NAME}


@app.post("/v1/embed", response_model=EmbedResponse)
def embed(
    body: EmbedBody,
    authorization: str | None = Header(default=None),
) -> EmbedResponse:
    _require_auth(authorization)
    img = decode_image(body.image)
    fa = get_face_app()
    faces = fa.get(img)
    if not faces:
        raise HTTPException(status_code=422, detail="NO_FACE")
    # largest face
    faces = sorted(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]), reverse=True)
    face = faces[0]
    emb = face.normed_embedding
    if emb is None:
        raise HTTPException(status_code=422, detail="NO_EMBEDDING")
    vec = [float(x) for x in emb.tolist()]
    score = float(getattr(face, "det_score", 0.0) or 0.0)
    return EmbedResponse(embedding=vec, model=MODEL_NAME, dim=len(vec), detection_score=score)
