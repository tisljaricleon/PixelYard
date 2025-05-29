services:
  postgres:
    container_name: app-db
    image: postgres:17.4-alpine
    environment:
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: pixel
      POSTGRES_DB: pixel
    ports:
      - "5432:5432"
    volumes:
      - ./data/postgres-data:/var/lib/postgresql/data
    restart: unless-stopped

  pgadmin:
    image: dpage/pgadmin4
    container_name: app-pgadmin
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@example.com
      PGADMIN_DEFAULT_PASSWORD: pixel
    ports:
      - "5050:80"
    depends_on:
      - postgres
    restart: unless-stopped

  server:
    build:
      context: .
    container_name: app-server
    env_file: .env
    depends_on:
      - postgres
    restart: unless-stopped
