FROM apache/age:release_PG16_1.6.0

RUN apt-get update && \
    apt-get install -y postgis postgresql-16-postgis-3 && \
    rm -rf /var/lib/apt/lists/*
