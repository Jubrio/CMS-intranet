# Image du backend Laravel pour l'hébergement (Render, Koyeb, etc.)
FROM php:8.4-cli-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq-dev libzip-dev libicu-dev unzip git ca-certificates \
    && docker-php-ext-install pdo_pgsql pgsql zip intl pcntl opcache \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
COPY docker/php.ini /usr/local/etc/php/conf.d/zz-app.ini

WORKDIR /app

# Dépendances d'abord (meilleur cache de build)
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist --no-interaction

COPY . .
RUN composer install --no-dev --optimize-autoloader --prefer-dist --no-interaction \
    && mkdir -p storage/framework/cache storage/framework/sessions storage/framework/views storage/logs bootstrap/cache \
    && chmod -R 775 storage bootstrap/cache

COPY docker/entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh

ENV PORT=10000 \
    PHP_CLI_SERVER_WORKERS=4
EXPOSE 10000

CMD ["/entrypoint.sh"]
