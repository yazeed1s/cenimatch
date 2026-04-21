BIN_DIR := bin

.PHONY: all app dl migrate db db-stop clean

all: app dl migrate

app:
	go build -o $(BIN_DIR)/cenimatch ./cmd/cenimatch/

dl:
	go build -o $(BIN_DIR)/download ./cmd/download/

migrate:
	go build -o $(BIN_DIR)/migrate ./cmd/migrate/

db:
	docker compose up --build -d

db-stop:
	docker compose down

clean:
	rm -rf $(BIN_DIR)
