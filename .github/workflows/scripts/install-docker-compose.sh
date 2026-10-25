#!/usr/bin/env bash
set -euo pipefail

# Installs a pinned, checksum-verified Docker Compose binary.
#
# The workflows only reach this when the runner image has no `docker compose`
# plugin. It used to download releases/latest with no verification, so whatever
# that URL served ran as root on a runner holding provider secrets. Bump
# COMPOSE_VERSION and both digests together, from the release's checksums.txt.
#
# Usage: ./install-docker-compose.sh <destination-path>
#   e.g. /usr/local/bin/docker-compose, or $DOCKER_CONFIG/cli-plugins/docker-compose

COMPOSE_VERSION="v5.6.0"

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <destination-path>" >&2
  exit 1
fi
DEST="$1"

case "$(uname -s)-$(uname -m)" in
  Linux-x86_64) ASSET="docker-compose-linux-x86_64"; SHA256="40343e21ca777173e69cff5dbafeb37c6f81f3b0d57d9e597f036e95eb63e76a" ;;
  Linux-aarch64) ASSET="docker-compose-linux-aarch64"; SHA256="733ec76717ceb59052a9609b9dadfb523b2df8eab57a54212872d10a58078ea2" ;;
  *) echo "::error::no pinned Docker Compose digest for $(uname -s)-$(uname -m)" >&2; exit 1 ;;
esac

TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

curl -fsSL "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/${ASSET}" -o "$TMP"
echo "${SHA256}  ${TMP}" | sha256sum -c -

mkdir -p "$(dirname "$DEST")" 2>/dev/null || sudo mkdir -p "$(dirname "$DEST")"
if [[ -w "$(dirname "$DEST")" ]]; then
  install -m 0755 "$TMP" "$DEST"
else
  sudo install -m 0755 "$TMP" "$DEST"
fi
echo "Installed Docker Compose ${COMPOSE_VERSION} at ${DEST}"
