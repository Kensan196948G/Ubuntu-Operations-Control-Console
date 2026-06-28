FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN addgroup --system uocc && adduser --system --ingroup uocc uocc

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY uocc_api /app/uocc_api

RUN mkdir -p /app/data && chown -R uocc:uocc /app
USER uocc

EXPOSE 8000
CMD ["uvicorn", "uocc_api.main:app", "--host", "0.0.0.0", "--port", "8000"]

