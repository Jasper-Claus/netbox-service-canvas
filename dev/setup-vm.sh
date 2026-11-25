#!/usr/bin/env bash
# Sets up a NetBox 4.5.7 dev stack with netbox-service-canvas on a fresh Ubuntu VM.
# Prerequisite: Docker Engine + compose plugin are installed (see dev/README.md, step 1).
#
# Usage:  PLUGIN_SRC=~/netbox-service-canvas ./dev/setup-vm.sh
set -euo pipefail

PLUGIN_SRC="${PLUGIN_SRC:-$HOME/netbox-service-canvas}"
NETBOX_DOCKER_DIR="${NETBOX_DOCKER_DIR:-$HOME/netbox-dev}"
NETBOX_DOCKER_RELEASE="4.0.2"   # netbox-docker release that ships NetBox v4.5.7

PLUGIN_SRC="$(cd "$PLUGIN_SRC" && pwd)"

# The source is bind-mounted into the container, where NetBox runs as a different user.
# Files copied from Windows (scp) may lack read/traverse bits for "others"; Python would then
# see netbox_service_canvas as an empty namespace package ("does not provide a 'config' variable").
chmod -R a+rX "$PLUGIN_SRC"

if [ ! -d "$NETBOX_DOCKER_DIR" ]; then
  git clone --depth 1 --branch "$NETBOX_DOCKER_RELEASE" \
    https://github.com/netbox-community/netbox-docker.git "$NETBOX_DOCKER_DIR"
fi

cp "$PLUGIN_SRC/dev/docker-compose.override.yml" "$NETBOX_DOCKER_DIR/docker-compose.override.yml"
cp "$PLUGIN_SRC/dev/plugins.py" "$NETBOX_DOCKER_DIR/configuration/plugins.py"
echo "PLUGIN_SRC=$PLUGIN_SRC" > "$NETBOX_DOCKER_DIR/.env"

cd "$NETBOX_DOCKER_DIR"
docker compose build netbox
docker compose up -d

echo
echo "Waiting for NetBox (first start runs all migrations, this can take a few minutes) ..."
until docker compose exec -T netbox curl -fs -o /dev/null http://localhost:8080/login/; do sleep 5; done

echo
echo "NetBox is up on http://$(hostname -I | awk '{print $1}'):8000"
echo "Create an admin user with:"
echo "  cd $NETBOX_DOCKER_DIR && docker compose exec netbox /opt/netbox/netbox/manage.py createsuperuser"
