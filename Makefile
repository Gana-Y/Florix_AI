.PHONY: up down build test logs clean help

help:
	@echo "Florix AI — Production Automation Commands"
	@echo "  make up       - Build and launch all services in detached Docker containers"
	@echo "  make down     - Stop and remove all running containers and networks"
	@echo "  make build    - Rebuild Docker images without cache"
	@echo "  make test     - Execute full backend automated evaluation and test suites"
	@echo "  make logs     - Stream combined container logs"
	@echo "  make clean    - Wipe dangling Docker containers, volumes, and caches"

up:
	docker compose up --build -d

down:
	docker compose down

build:
	docker compose build --no-cache

test:
	cd Backend && pytest -v

logs:
	docker compose logs -f

clean:
	docker compose down -v --remove-orphans
