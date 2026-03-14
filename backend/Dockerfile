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

# Data directory (mount as volume in production for persistence)
VOLUME /pb/pb_data

EXPOSE 8090

# Start PocketBase — binds to 0.0.0.0 so Railway can reach it
# Railway injects $PORT — default to 8090 for local Docker use
CMD /pb/pocketbase serve --http=0.0.0.0:${PORT:-8090}
