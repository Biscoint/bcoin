FROM node:16-alpine AS base

RUN mkdir /code
WORKDIR /code
CMD "bcoin"

# ARG BCOIN_VERSION
# ARG BCOIN_REPO

# ENV BCOIN_VERSION=${BCOIN_VERSION} \
#     BCOIN_REPO=${BCOIN_REPO}

RUN apk upgrade --no-cache && \
    apk add --no-cache bash git

COPY . /code/

FROM base AS build

# Install build dependencies
RUN apk add --no-cache g++ gcc make python3 patch
# COPY *.patch .
# RUN patch --no-backup-if-mismatch -p1 < fix-tx-notification-for-spv-node.patch
RUN npm rebuild --verbose

# Copy built files, but don't include build deps
FROM base
ENV PATH="${PATH}:/code/bin:/code/node_modules/.bin"
COPY --from=build /code /code/

# Main, testnet and regtest ports
EXPOSE 8334 8333 8332 18334 18333 18332 48332 48333 48334
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 CMD [ "bcoin-cli info >/dev/null" ]
