FROM curlimages/curl:8.12.1

COPY invoke.sh /invoke.sh

# Railway Cron 스케줄 미적용 시에도 5분마다 호출 (장기 실행 워커)
CMD ["/bin/sh", "-c", "while true; do /bin/sh /invoke.sh || true; sleep 300; done"]
