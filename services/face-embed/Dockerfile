FROM python:3.11-slim-bookworm

WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential g++ \
    libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip setuptools wheel \
    && pip install --no-cache-dir -r requirements.txt \
    && apt-get purge -y --auto-remove build-essential g++ \
    && rm -rf /var/lib/apt/lists/*

COPY app.py .

ENV PORT=8090
EXPOSE 8090
# Railway는 PORT 를 주입함
CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT:-8090}"]
