FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN addgroup --system uocc-agent && adduser --system --ingroup uocc-agent uocc-agent

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY src/uocc_agent /app/uocc_agent

USER uocc-agent

EXPOSE 8787
CMD ["uvicorn", "uocc_agent.main:app", "--host", "0.0.0.0", "--port", "8787"]

