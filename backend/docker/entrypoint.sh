#!/bin/sh
set -e
cd /app

# Optimisations Laravel (la config lit les variables d'environnement de l'hébergeur)
php artisan config:cache
php artisan view:cache

# Schéma de base de données
php artisan migrate --force

# Données initiales (modules + super-administrateur) : à activer au premier déploiement seulement
if [ "$RUN_SEEDER" = "true" ]; then
    php artisan db:seed --force
fi

exec php artisan serve --no-reload --host=0.0.0.0 --port="${PORT:-10000}"
