# AquaLeads — small FastAPI + SQLite (persist DB on a host volume)
FROM python:3.12-slim

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000
# Production: no --reload, listen on all interfaces, DB path from env
ENV AQUA_LEADS_RELOAD=0
ENV LISTEN_HOST=0.0.0.0
ENV DATABASE_PATH=/data/water-leads.db

VOLUME ["/data"]

CMD ["sh", "-c", "uvicorn main:app --host ${LISTEN_HOST:-0.0.0.0} --port ${LISTEN_PORT:-8000}"]
