# The agent image, baked. No boot-time wget, no tar, no compose-shell guessing.
FROM node:22-alpine
WORKDIR /app
COPY . /app
RUN apk add --no-cache bash curl tini && sed -i 's/$//' /app/start.sh /app/*.mjs 2>/dev/null; chmod +x /app/start.sh && ln -sfn /app/infrastructure /infrastructure
ENV AGENT_BUNDLE=1 \
    AGENT_BUNDLE_DIR=/app \
    AGENT_RUNTIME_DIR=/app \
    AGENT_GUEST_ROOT=/var/lib/agent \
    AGENT_HTTP_PORT=8787 \
    AGENT_BIND=0.0.0.0
EXPOSE 8787
CMD ["/bin/sh", "/app/start.sh"]
