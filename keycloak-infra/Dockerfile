FROM quay.io/keycloak/keycloak:latest

# Variables d'environnement pour l'exposition réseau et HTTPS Render
ENV KC_PROXY=edge
ENV KC_HTTP_ENABLED=true
ENV KC_HTTP_HOST=0.0.0.0
ENV KC_HTTP_PORT=8080

ENTRYPOINT ["/opt/keycloak/bin/kc.sh", "start-dev", "--http-port=8080"]