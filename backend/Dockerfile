FROM alpine:3.19

# Install dependencies
RUN apk add --no-cache ca-certificates wget unzip

# Download PocketBase Linux binary
ARG PB_VERSION=0.36.6
RUN wget -q "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip" \
    -O /tmp/pocketbase.zip && \
    unzip /tmp/pocketbase.zip pocketbase -d /pb/ && \
    chmod +x /pb/pocketbase && \
    rm /tmp/pocketbase.zip

WORKDIR /pb

# Copy migrations so PocketBase auto-runs them on first start
COPY pb_migrations/ /pb/pb_migrations/

# Data directory — mounted as persistent volume on fly.io
VOLUME /pb/pb_data

EXPOSE 8090

CMD /pb/pocketbase serve --http=0.0.0.0:8090
