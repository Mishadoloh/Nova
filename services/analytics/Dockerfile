FROM python:3.13-slim AS test
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.txt requirements-dev.txt ./
RUN pip install --no-cache-dir --requirement requirements-dev.txt
COPY nova_analytics ./nova_analytics
COPY tests ./tests
RUN PYTHONPATH=/app pytest -q && touch /test-passed

FROM python:3.13-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
RUN groupadd --system nova && useradd --system --gid nova --create-home nova
COPY requirements.txt ./
RUN pip install --no-cache-dir --requirement requirements.txt
COPY nova_analytics ./nova_analytics
COPY --from=test /test-passed /test-passed
USER nova
EXPOSE 8090
CMD ["python", "-m", "nova_analytics"]
