# 안면 인식 v2 — SSD 강화 + InsightFace 서버

## 단계

### A (앱에 포함됨) — 클라이언트 강화
- 감지: **SSD MobileNet v1** + 출퇴근 시 Tiny **폴백**
- 등록 품질 게이트 강화 (밝기·크기·detection)
- 출퇴근 **4프레임 평균** + 최소 인식률 **60%**
- 매칭: face-api(V1)와 InsightFace(V2) 중 **더 높은 인식률** 채택

### B1 — 서버 InsightFace (권장, 환경변수로 활성)
1. `services/face-embed` 사이드카 기동 (InsightFace `buffalo_l`, 512-d)
2. Railway/호스트에 `FACE_EMBED_SERVICE_URL` (+ 선택 `FACE_EMBED_SERVICE_SECRET`) 설정
3. 등록 시 `previewUrl`로 서버 임베딩 → `EmployeeFaceCredential.descriptorV2` 저장
4. root **메뉴 설정**에서 「기존 등록에 V2 임베딩 채우기」로 백필 가능

## Railway에 face-embed 배포

1. Railway 프로젝트에 **Empty Service** 추가 → Root Directory: `services/face-embed`
2. Dockerfile 빌드 (`services/face-embed/railway.toml` 참고)
3. 변수 (선택): `FACE_EMBED_SERVICE_SECRET=<긴-랜덤>`
4. 공개 URL 확인 후 **heresnow** 서비스에:
   ```
   FACE_EMBED_SERVICE_URL=https://<face-embed-public-url>
   FACE_EMBED_SERVICE_SECRET=<동일-시크릿>
   FACE_EMBED_MATCH_THRESHOLD=0.42
   ```
5. heresnow 재배포 → root 메뉴 설정에서 V2 백필 실행
6. 정확도 최대화를 위해 직원 **안면 재등록** 권장

## 로컬 face-embed

```bash
cd services/face-embed
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8090
```

앱 `.env`:

```
FACE_EMBED_SERVICE_URL=http://127.0.0.1:8090
# FACE_EMBED_SERVICE_SECRET=
# FACE_EMBED_MATCH_THRESHOLD=0.42
```

DB 마이그레이션: `20261017120000_face_descriptor_v2`

## 재등록
- 기존 직원은 `descriptor`(128-d)만 있으면 V1으로 계속 동작
- **정확도 최대화**를 위해 서버 활성 후 **안면 재등록** 권장 (descriptorV2 채움)
