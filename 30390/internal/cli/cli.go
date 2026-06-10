package cli

import (
	"fmt"
	"io"
	"os"
	"text/tabwriter"
)

var (
	Output io.Writer = os.Stdout
	Error  io.Writer = os.Stderr
)

type TableWriter struct {
	w *tabwriter.Writer
}

func NewTableWriter() *TableWriter {
	return &TableWriter{
		w: tabwriter.NewWriter(Output, 0, 0, 2, ' ', 0),
	}
}

func (t *TableWriter) Header(columns ...string) {
	row := make([]interface{}, len(columns))
	for i, c := range columns {
		row[i] = c
	}
	t.Row(row...)
}

func (t *TableWriter) Row(values ...interface{}) {
	for i, v := range values {
		if i > 0 {
			fmt.Fprint(t.w, "\t")
		}
		fmt.Fprint(t.w, v)
	}
	fmt.Fprintln(t.w)
}

func (t *TableWriter) Flush() {
	t.w.Flush()
}

func PrintTable(headers []string, rows [][]interface{}) {
	t := NewTableWriter()
	t.Header(headers...)
	for _, row := range rows {
		t.Row(row...)
	}
	t.Flush()
}

func PrintError(format string, args ...interface{}) {
	fmt.Fprintln(Error, fmt.Sprintf(format, args...))
}

func PrintSuccess(format string, args ...interface{}) {
	fmt.Fprintln(Output, fmt.Sprintf(format, args...))
}

func PrintInfo(format string, args ...interface{}) {
	fmt.Fprintln(Output, fmt.Sprintf(format, args...))
}
