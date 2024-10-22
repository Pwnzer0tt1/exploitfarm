
# Exploitfarm Dockerfile UUID signature
# c9ce2441-d842-44d7-9178-dd1617efb8f6
# Needed for start.py to detect the Dockerfile

FROM --platform=$BUILDPLATFORM oven/bun AS frontend
ENV NODE_ENV=production
WORKDIR /build
COPY ./frontend/package.json ./frontend/bun.lockb /build/
RUN bun install
COPY ./frontend/ .
RUN bun run build


#Building main conteiner
FROM --platform=$TARGETARCH python:3.12-slim AS base
RUN pip install uv
RUN apt-get update && apt-get install -y --no-install-recommends libcapstone-dev build-essential
WORKDIR /execute
ADD ./backend/pyproject.toml /execute/pyproject.toml
RUN uv pip install --system --no-cache .
COPY ./client/ /tmp/client
RUN uv pip install --system --no-cache /tmp/client && rm -rf /tmp/client

FROM --platform=$TARGETARCH base AS final

COPY ./backend/ /execute/
COPY --from=frontend /build/dist/ ./frontend/

CMD ["python3", "/execute/app.py"]
