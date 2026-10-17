# 안면 인식 v2 — SSD 강화 + InsightFace 서버

## 단계

### A (앱에 포함됨) — 클라이언트 강화
- 감지: **SSD MobileNet v1** (로그인·등록·검증), Tiny는 존재 여부용
- 등록 품질 게이트 강화 (밝기·크기·detection)
- 매칭 임계값·마진·로그인 신뢰도 기본값 소폭 강화

### B1 — 서버 InsightFace (선택, 환경변수로 활성)
1. `services/face-embed` 사이드카 기동 (InsightFace `buffalo_l`, 512-d)
2. Railway/호스트에 `FACE_EMBED_SERVICE_URL` (+ 선택 `FACE_EMBED_SERVICE_SECRET`) 설정
3. 등록 시 `previewUrl`로 서버 임베딩 → `EmployeeFaceCredential.descriptorV2` 저장
4. 검증·출근: `descriptorV2`가 있으면 **서버 코사인 유사도** 우선, 없으면 face-api 128-d

### 하이브리드
- 기기: SSD로 얼굴 품질·크롭 (빠름)
- 서버: InsightFace 임베딩·매칭 (정확)
- 서비스 미설정/실패 시 자동으로 레거시 128-d 폴백

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
# FACE_EMBED_MATCH_THRESHOLD=0.38
```

DB 마이그레이션: `20261017120000_face_descriptor_v2`

## 재등록
- 기존 직원은 `descriptor`(128-d)만 있으면 레거시 경로로 계속 동작
- **정확도 최대화**를 위해 서버 활성 후 **안면 재등록** 권장 (descriptorV2 채움)
