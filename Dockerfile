FROM --platform=$BUILDPLATFORM oven/bun AS frontend
ENV NODE_ENV=production
WORKDIR /build
COPY ./frontend/package.json ./frontend/bun.lockb /build/
RUN bun install
COPY ./frontend/ .
RUN bun run build


#Building main conteiner
FROM --platform=$TARGETARCH python:slim-bookworm AS base
RUN apt-get update && apt-get install -y --no-install-recommends libcapstone-dev build-essential
WORKDIR /execute
ADD ./backend/requirements.txt /execute/requirements.txt
RUN pip3 install --no-cache-dir --break-system-packages -r /execute/requirements.txt --no-warn-script-location
COPY ./client/ /tmp/client
RUN pip3 install --no-cache-dir --break-system-packages /tmp/client
COPY ./backend/ /execute/
COPY --from=frontend /build/dist/ ./frontend/

CMD ["python3", "/execute/app.py"]
