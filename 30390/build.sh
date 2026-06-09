#!/usr/bin/env bash
set -euo pipefail

BINARY="gitmon"
PKG="github.com/gitmon/gitmon"
VERSION_PKG="${PKG}/internal/version"

GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
BUILD_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
VERSION=$(git describe --tags --always --dirty 2>/dev/null || echo "dev")

LDFLAGS="-s -w \
    -X '${VERSION_PKG}.Version=${VERSION}' \
    -X '${VERSION_PKG}.BuildTime=${BUILD_TIME}' \
    -X '${VERSION_PKG}.GitCommit=${GIT_COMMIT}'"

GO="${GO:-go}"

usage() {
    echo "Usage: $0 [target]"
    echo ""
    echo "Targets:"
    echo "  build    - Build binary for current platform (default)"
    echo "  all      - Build for all platforms"
    echo "  test     - Run tests"
    echo "  bench    - Run benchmarks"
    echo "  clean    - Remove binaries"
    echo "  version  - Show version info"
    exit 1
}

build() {
    echo "Building ${BINARY}..."
    echo "  Version: ${VERSION}"
    echo "  Commit:  ${GIT_COMMIT}"
    echo "  Time:    ${BUILD_TIME}"
    echo ""
    ${GO} build -ldflags "${LDFLAGS}" -o "${BINARY}" "${PKG}"
    echo "✓ Build complete: ${BINARY}"
}

build_all() {
    echo "Building for all platforms..."
    for os in linux darwin; do
        for arch in amd64 arm64; do
            echo "  ${os}/${arch}..."
            output="${BINARY}-${os}-${arch}"
            GOOS=${os} GOARCH=${arch} ${GO} build -ldflags "${LDFLAGS}" -o "${output}" "${PKG}"
        done
    done
    echo "✓ All builds complete"
}

run_tests() {
    echo "Running tests..."
    ${GO} test -v -race ./...
}

run_bench() {
    echo "Running benchmarks..."
    ${GO} test -bench=. -benchmem ./internal/analyzer ./internal/report ./internal/storage
}

clean() {
    rm -f "${BINARY}" "${BINARY}"-*
    echo "✓ Cleaned"
}

show_version() {
    echo "Version: ${VERSION}"
    echo "Git Commit: ${GIT_COMMIT}"
    echo "Build Time: ${BUILD_TIME}"
}

case "${1:-build}" in
    build) build ;;
    all) build_all ;;
    test) run_tests ;;
    bench) run_bench ;;
    clean) clean ;;
    version) show_version ;;
    help|*) usage ;;
esac
