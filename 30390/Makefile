.PHONY: build build-all clean test bench lint vet format help

BINARY := gitmon
PKG := github.com/gitmon/gitmon
VERSION_PKG := $(PKG)/internal/version

GIT_COMMIT := $(shell git rev-parse --short HEAD 2>/dev/null || echo "unknown")
BUILD_TIME := $(shell date -u +"%Y-%m-%dT%H:%M:%SZ")
VERSION := $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")

LDFLAGS := -s -w \
	-X '$(VERSION_PKG).Version=$(VERSION)' \
	-X '$(VERSION_PKG).BuildTime=$(BUILD_TIME)' \
	-X '$(VERSION_PKG).GitCommit=$(GIT_COMMIT)'

GO ?= go
GOFLAGS ?=

build:
	$(GO) build -ldflags "$(LDFLAGS)" -o $(BINARY) $(PKG)

build-all:
	@echo "Building for Linux amd64..."
	@GOOS=linux GOARCH=amd64 $(GO) build -ldflags "$(LDFLAGS)" -o $(BINARY)-linux-amd64 $(PKG)
	@echo "Building for Linux arm64..."
	@GOOS=linux GOARCH=arm64 $(GO) build -ldflags "$(LDFLAGS)" -o $(BINARY)-linux-arm64 $(PKG)
	@echo "Building for macOS amd64..."
	@GOOS=darwin GOARCH=amd64 $(GO) build -ldflags "$(LDFLAGS)" -o $(BINARY)-darwin-amd64 $(PKG)
	@echo "Building for macOS arm64..."
	@GOOS=darwin GOARCH=arm64 $(GO) build -ldflags "$(LDFLAGS)" -o $(BINARY)-darwin-arm64 $(PKG)

install:
	$(GO) install -ldflags "$(LDFLAGS)" $(PKG)

test:
	$(GO) test -v -race ./...

bench:
	$(GO) test -bench=. -benchmem ./internal/analyzer ./internal/report ./internal/storage

lint:
	@command -v golangci-lint >/dev/null 2>&1 || { echo "golangci-lint not found, installing..."; $(GO) install github.com/golangci/golangci-lint/cmd/golangci-lint@latest; }
	golangci-lint run

vet:
	$(GO) vet ./...

format:
	$(GO) fmt ./...

clean:
	rm -f $(BINARY) $(BINARY)-*

run: build
	./$(BINARY) --version

version:
	@echo "Version: $(VERSION)"
	@echo "Git Commit: $(GIT_COMMIT)"
	@echo "Build Time: $(BUILD_TIME)"

help:
	@echo "Available targets:"
	@echo "  build       - Build binary for current platform"
	@echo "  build-all   - Build binaries for all platforms (Linux/macOS, amd64/arm64)"
	@echo "  install     - Install binary to GOPATH/bin"
	@echo "  test        - Run all tests with race detector"
	@echo "  bench       - Run benchmark tests"
	@echo "  lint        - Run golangci-lint"
	@echo "  vet         - Run go vet"
	@echo "  format      - Format all Go files"
	@echo "  clean       - Remove built binaries"
	@echo "  run         - Build and show version"
	@echo "  version     - Show version info"
