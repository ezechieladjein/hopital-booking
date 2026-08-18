FROM quay.io/keycloak/keycloak:latest

# Configuration pour le mode production / proxy Render
ENV KC_PROXY=edge
ENV KC_HTTP_ENABLED=true

ENTRYPOINT ["/opt/keycloak/bin/kc.sh", "start-dev"]