FROM php:8.2-fpm

# Installation des paquets système nécessaires
RUN apt-get update && apt-get install -y \
    git \
    curl \
    libpng-dev \
    libonig-dev \
    libxml2-dev \
    zip \
    unzip

# Configuration et installation des extensions PHP requises par Laravel
RUN docker-php-ext-configure gd && \
    docker-php-ext-install pdo_mysql mbstring gd bcmath

# Récupération de l'exécutable Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /var/www

# Copie des fichiers du projet Laravel
COPY . .

# Installation des dépendances PHP avec Composer
RUN composer install --no-dev --optimize-autoloader

EXPOSE 8000

# Commande de démarrage
CMD php artisan serve --host=0.0.0.0 --port=8000