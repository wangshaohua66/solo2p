package main

import (
	"fmt"
	"os"
	"runtime/debug"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"github.com/remote-sensing/sentinel-cli/internal/cmd"
)

var (
	Version   = "dev"
	GitCommit = "none"
	BuildDate = "unknown"
)

func main() {
	cmd.Version = Version
	cmd.GitCommit = GitCommit
	cmd.BuildDate = BuildDate

	defer func() {
		if r := recover(); r != nil {
			stack := debug.Stack()
			log.Logger = zerolog.New(os.Stderr).With().
				Timestamp().
				Str("version", Version).
				Str("commit", GitCommit).
				Logger()

			log.Error().
				Str("panic", fmt.Sprintf("%v", r)).
				Str("stack", string(stack)).
				Msg("unexpected panic recovered")

			fmt.Fprintln(os.Stderr)
			fmt.Fprintf(os.Stderr, "严重错误 | Fatal Error: %v\n", r)
			fmt.Fprintln(os.Stderr)
			fmt.Fprintln(os.Stderr, "堆栈跟踪 | Stack Trace:")
			fmt.Fprintln(os.Stderr, string(stack))
			os.Exit(1)
		}
	}()

	cmd.Execute()
}
