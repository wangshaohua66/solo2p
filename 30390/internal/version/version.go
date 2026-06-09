package version

import (
	"fmt"
	"runtime"
)

var (
	Version   = "1.0.0"
	BuildTime = "unknown"
	GitCommit = "unknown"
	GoVersion = runtime.Version()
	OsArch    = fmt.Sprintf("%s/%s", runtime.GOOS, runtime.GOARCH)
)

func Print() {
	fmt.Printf("gitmon %s\n", Version)
	fmt.Printf("  Build Time: %s\n", BuildTime)
	fmt.Printf("  Git Commit: %s\n", GitCommit)
	fmt.Printf("  Go Version: %s\n", GoVersion)
	fmt.Printf("  OS/Arch:    %s\n", OsArch)
}

func String() string {
	return fmt.Sprintf("gitmon %s (build: %s, commit: %s, go: %s)",
		Version, BuildTime, GitCommit, GoVersion)
}
