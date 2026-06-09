package git

import (
	"bufio"
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

type Client struct {
	repoPath string
	repoName string
	mode     string
}

func NewClient(repoPath, repoName, mode string) (*Client, error) {
	absPath, err := filepath.Abs(repoPath)
	if err != nil {
		return nil, fmt.Errorf("resolve path: %w", err)
	}
	if mode == "" {
		mode = "worktree"
	}
	return &Client{
		repoPath: absPath,
		repoName: repoName,
		mode:     mode,
	}, nil
}

func (c *Client) run(ctx context.Context, args ...string) (string, error) {
	var cmd *exec.Cmd
	if c.mode == "bare" {
		args = append([]string{"--git-dir", c.repoPath}, args...)
		cmd = exec.CommandContext(ctx, "git", args...)
	} else {
		cmd = exec.CommandContext(ctx, "git", args...)
		cmd.Dir = c.repoPath
	}

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("git %s: %w: %s", strings.Join(args, " "), err, stderr.String())
	}
	return stdout.String(), nil
}

func (c *Client) IsBare(ctx context.Context) (bool, error) {
	out, err := c.run(ctx, "rev-parse", "--is-bare-repository")
	if err != nil {
		return false, err
	}
	return strings.TrimSpace(out) == "true", nil
}

func (c *Client) GetRepoInfo(ctx context.Context) (*RepoInfo, error) {
	isBare, _ := c.IsBare(ctx)
	mode := "worktree"
	if isBare {
		mode = "bare"
	}

	headBranch, _ := c.run(ctx, "rev-parse", "--abbrev-ref", "HEAD")
	headCommit, _ := c.run(ctx, "rev-parse", "HEAD")
	commitCount, _ := c.run(ctx, "rev-list", "--count", "HEAD")

	remotes := make(map[string]string)
	if remoteOut, err := c.run(ctx, "remote"); err == nil {
		for _, r := range strings.Split(strings.TrimSpace(remoteOut), "\n") {
			r = strings.TrimSpace(r)
			if r == "" {
				continue
			}
			if urlOut, err := c.run(ctx, "remote", "get-url", r); err == nil {
				remotes[r] = strings.TrimSpace(urlOut)
			}
		}
	}

	var lastCommit, firstCommit time.Time
	if lastOut, err := c.run(ctx, "log", "-1", "--format=%ct"); err == nil {
		if ts, err := strconv.ParseInt(strings.TrimSpace(lastOut), 10, 64); err == nil {
			lastCommit = time.Unix(ts, 0)
		}
	}
	if firstOut, err := c.run(ctx, "log", "--reverse", "--format=%ct", "-1"); err == nil {
		if ts, err := strconv.ParseInt(strings.TrimSpace(firstOut), 10, 64); err == nil {
			firstCommit = time.Unix(ts, 0)
		}
	}

	var branches []string
	if brOut, err := c.run(ctx, "branch", "--all", "--format=%(refname:short)"); err == nil {
		for _, b := range strings.Split(strings.TrimSpace(brOut), "\n") {
			b = strings.TrimSpace(b)
			if b != "" {
				branches = append(branches, b)
			}
		}
	}

	count, _ := strconv.Atoi(strings.TrimSpace(commitCount))

	return &RepoInfo{
		Name:        c.repoName,
		Path:        c.repoPath,
		Mode:        mode,
		HeadBranch:  strings.TrimSpace(headBranch),
		HeadCommit:  strings.TrimSpace(headCommit),
		Remotes:     remotes,
		LastCommit:  lastCommit,
		CommitCount: count,
		FirstCommit: firstCommit,
		Branches:    branches,
	}, nil
}

func (c *Client) Log(ctx context.Context, since time.Time, maxCount int) ([]Commit, error) {
	format := `--format=COMMIT:%H%n%h%n%an%n%ae%n%at%n%cn%n%ce%n%ct%n%P%n%s%n%b%nENDCOMMIT`
	args := []string{"log", format, "--numstat", "-M", "--first-parent"}

	if !since.IsZero() {
		args = append(args, "--since="+since.Format(time.RFC3339))
	}
	if maxCount > 0 {
		args = append(args, fmt.Sprintf("-n%d", maxCount))
	}

	out, err := c.run(ctx, args...)
	if err != nil {
		return nil, err
	}

	return c.parseCommits(out)
}

func (c *Client) parseCommits(output string) ([]Commit, error) {
	var commits []Commit
	scanner := bufio.NewScanner(strings.NewReader(output))
	scanner.Buffer(make([]byte, 1024*1024), 10*1024*1024)

	var current *Commit
	inBody := false
	var bodyLines []string

	for scanner.Scan() {
		line := scanner.Text()

		if strings.HasPrefix(line, "COMMIT:") {
			if current != nil {
				current.Body = strings.Join(bodyLines, "\n")
				commits = append(commits, *current)
			}
			hash := strings.TrimPrefix(line, "COMMIT:")
			current = &Commit{
				Hash:     hash,
				RepoName: c.repoName,
			}
			bodyLines = nil
			inBody = false
			continue
		}

		if current == nil {
			continue
		}

		if strings.HasPrefix(line, "ENDCOMMIT") {
			continue
		}

		if current.ShortHash == "" {
			current.ShortHash = line
			continue
		}
		if current.AuthorName == "" {
			current.AuthorName = line
			continue
		}
		if current.AuthorEmail == "" {
			current.AuthorEmail = line
			continue
		}
		if current.AuthorDate.IsZero() {
			if ts, err := strconv.ParseInt(line, 10, 64); err == nil {
				current.AuthorDate = time.Unix(ts, 0)
			}
			continue
		}
		if current.CommitterName == "" {
			current.CommitterName = line
			continue
		}
		if current.CommitterEmail == "" {
			current.CommitterEmail = line
			continue
		}
		if current.CommitterDate.IsZero() {
			if ts, err := strconv.ParseInt(line, 10, 64); err == nil {
				current.CommitterDate = time.Unix(ts, 0)
			}
			continue
		}
		if len(current.Parents) == 0 && current.Subject == "" {
			if line != "" {
				current.Parents = strings.Fields(line)
				current.IsMerge = len(current.Parents) > 1
			}
			continue
		}
		if current.Subject == "" {
			current.Subject = line
			inBody = true
			continue
		}

		if inBody {
			if line == "" || (len(line) > 0 && (line[0] >= '0' && line[0] <= '9' || line[0] == '-')) {
				if fc := parseFileChange(line); fc != nil {
					current.Files = append(current.Files, *fc)
				} else if line != "" {
					bodyLines = append(bodyLines, line)
				}
			} else {
				bodyLines = append(bodyLines, line)
			}
		}
	}

	if current != nil {
		current.Body = strings.Join(bodyLines, "\n")
		commits = append(commits, *current)
	}

	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("parse commits: %w", err)
	}

	return commits, nil
}

func parseFileChange(line string) *FileChange {
	parts := strings.Fields(line)
	if len(parts) < 3 {
		return nil
	}

	additions := 0
	if parts[0] != "-" {
		additions, _ = strconv.Atoi(parts[0])
	}
	deletions := 0
	if parts[1] != "-" {
		deletions, _ = strconv.Atoi(parts[1])
	}

	path := parts[2]
	oldPath := ""
	status := "M"

	if len(parts) > 3 {
		firstChar := path
		if len(firstChar) > 0 {
			switch firstChar[0] {
			case 'A':
				status = "A"
			case 'D':
				status = "D"
			case 'R':
				status = "R"
				if len(parts) > 4 {
					oldPath = parts[2]
					path = parts[3]
				}
			}
		}
	}

	return &FileChange{
		Path:      path,
		OldPath:   oldPath,
		Status:    status,
		Additions: additions,
		Deletions: deletions,
		IsBinary:  parts[0] == "-" && parts[1] == "-",
	}
}

func (c *Client) Blame(ctx context.Context, filePath string) (*FileBlame, error) {
	out, err := c.run(ctx, "blame", "--porcelain", filePath)
	if err != nil {
		return nil, err
	}
	return c.parseBlame(out, filePath)
}

func (c *Client) parseBlame(output, filePath string) (*FileBlame, error) {
	blame := &FileBlame{Path: filePath}
	scanner := bufio.NewScanner(strings.NewReader(output))
	scanner.Buffer(make([]byte, 1024*1024), 10*1024*1024)

	var current *BlameLine
	hashMap := make(map[string]*BlameLine)

	for scanner.Scan() {
		line := scanner.Text()
		parts := strings.Fields(line)

		if len(parts) >= 3 && len(parts[0]) == 40 {
			hash := parts[0]
			lineNoOrig, _ := strconv.Atoi(parts[1])
			lineNum, _ := strconv.Atoi(parts[2])

			if existing, ok := hashMap[hash]; ok {
				current = &BlameLine{
					Hash:       existing.Hash,
					Author:     existing.Author,
					Email:      existing.Email,
					Date:       existing.Date,
					LineNum:    lineNum,
					LineNoOrig: lineNoOrig,
				}
			} else {
				current = &BlameLine{
					Hash:       hash,
					LineNum:    lineNum,
					LineNoOrig: lineNoOrig,
				}
				hashMap[hash] = current
			}
			continue
		}

		if current == nil {
			continue
		}

		if strings.HasPrefix(line, "author ") {
			current.Author = strings.TrimPrefix(line, "author ")
		} else if strings.HasPrefix(line, "author-mail ") {
			current.Email = strings.Trim(strings.TrimPrefix(line, "author-mail "), "<>")
		} else if strings.HasPrefix(line, "author-time ") {
			if ts, err := strconv.ParseInt(strings.TrimPrefix(line, "author-time "), 10, 64); err == nil {
				current.Date = time.Unix(ts, 0)
			}
		} else if strings.HasPrefix(line, "\t") {
			current.Content = strings.TrimPrefix(line, "\t")
			blame.Lines = append(blame.Lines, *current)
			current = nil
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("parse blame: %w", err)
	}

	return blame, nil
}

func (c *Client) Reflog(ctx context.Context, maxEntries int) ([]ReflogEntry, error) {
	format := `--format=%gD|%h|%H|%gs|%gd|%ct`
	args := []string{"reflog", "show", format}
	if maxEntries > 0 {
		args = append(args, fmt.Sprintf("-n%d", maxEntries))
	}

	out, err := c.run(ctx, args...)
	if err != nil {
		return nil, err
	}

	var entries []ReflogEntry
	for _, line := range strings.Split(strings.TrimSpace(out), "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		parts := strings.SplitN(line, "|", 6)
		if len(parts) < 6 {
			continue
		}

		ts, _ := strconv.ParseInt(parts[5], 10, 64)
		entry := ReflogEntry{
			OldHash:   parts[1],
			NewHash:   parts[2],
			Action:    parts[3],
			Message:   parts[4],
			Timestamp: time.Unix(ts, 0),
		}
		entries = append(entries, entry)
	}

	return entries, nil
}

func (c *Client) ListFiles(ctx context.Context) ([]string, error) {
	out, err := c.run(ctx, "ls-files")
	if err != nil {
		return nil, err
	}

	var files []string
	for _, line := range strings.Split(strings.TrimSpace(out), "\n") {
		line = strings.TrimSpace(line)
		if line != "" {
			files = append(files, line)
		}
	}
	return files, nil
}

func (c *Client) GetFileContent(ctx context.Context, commit, path string) (string, error) {
	return c.run(ctx, "show", commit+":"+path)
}

func (c *Client) GetLastCommitTime(ctx context.Context) (time.Time, error) {
	out, err := c.run(ctx, "log", "-1", "--format=%ct")
	if err != nil {
		return time.Time{}, err
	}
	ts, err := strconv.ParseInt(strings.TrimSpace(out), 10, 64)
	if err != nil {
		return time.Time{}, err
	}
	return time.Unix(ts, 0), nil
}

func (c *Client) Checkout(ctx context.Context, branch string) error {
	_, err := c.run(ctx, "checkout", branch)
	return err
}

func (c *Client) Pull(ctx context.Context) error {
	_, err := c.run(ctx, "pull", "--ff-only")
	return err
}

func (c *Client) Fetch(ctx context.Context, remote string) error {
	args := []string{"fetch"}
	if remote != "" {
		args = append(args, remote)
	}
	_, err := c.run(ctx, args...)
	return err
}

func (c *Client) IsRepo(ctx context.Context) bool {
	_, err := c.run(ctx, "rev-parse", "--git-dir")
	return err == nil
}

func (c *Client) Diff(ctx context.Context, oldHash, newHash string) ([]FileChange, error) {
	args := []string{"diff", "--numstat", "-M"}
	if oldHash != "" && newHash != "" {
		args = append(args, oldHash, newHash)
	}

	out, err := c.run(ctx, args...)
	if err != nil {
		return nil, err
	}

	var changes []FileChange
	for _, line := range strings.Split(strings.TrimSpace(out), "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		if fc := parseFileChange(line); fc != nil {
			changes = append(changes, *fc)
		}
	}

	return changes, nil
}

func RunGitCommand(ctx context.Context, args ...string) (string, error) {
	if _, err := exec.LookPath("git"); err != nil {
		return "", errors.New("git command not found in PATH")
	}
	cmd := exec.CommandContext(ctx, "git", args...)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("git %s: %w: %s", strings.Join(args, " "), err, stderr.String())
	}
	return stdout.String(), nil
}

func StreamLog(ctx context.Context, repoPath string, since time.Time, maxCount int) (<-chan Commit, <-chan error) {
	commitChan := make(chan Commit, 100)
	errChan := make(chan error, 1)

	go func() {
		defer close(commitChan)
		defer close(errChan)

		format := `COMMIT:%H%n%h%n%an%n%ae%n%at%n%cn%n%ce%n%ct%n%P%n%s%n%b%nENDCOMMIT`
		args := []string{"-C", repoPath, "log", format, "--numstat", "-M", "--first-parent"}

		if !since.IsZero() {
			args = append(args, "--since="+since.Format(time.RFC3339))
		}
		if maxCount > 0 {
			args = append(args, fmt.Sprintf("-n%d", maxCount))
		}

		cmd := exec.CommandContext(ctx, "git", args...)
		stdout, err := cmd.StdoutPipe()
		if err != nil {
			errChan <- err
			return
		}

		if err := cmd.Start(); err != nil {
			errChan <- err
			return
		}

		parseStreamCommits(ctx, stdout, commitChan)

		if err := cmd.Wait(); err != nil {
			errChan <- err
		}
	}()

	return commitChan, errChan
}

func parseStreamCommits(ctx context.Context, r io.Reader, out chan<- Commit) {
	scanner := bufio.NewScanner(r)
	scanner.Buffer(make([]byte, 1024*1024), 10*1024*1024)

	var current *Commit
	inBody := false
	var bodyLines []string

	for scanner.Scan() {
		select {
		case <-ctx.Done():
			return
		default:
		}

		line := scanner.Text()

		if strings.HasPrefix(line, "COMMIT:") {
			if current != nil {
				current.Body = strings.Join(bodyLines, "\n")
				out <- *current
			}
			hash := strings.TrimPrefix(line, "COMMIT:")
			current = &Commit{Hash: hash}
			bodyLines = nil
			inBody = false
			continue
		}

		if current == nil {
			continue
		}

		if strings.HasPrefix(line, "ENDCOMMIT") {
			continue
		}

		if current.ShortHash == "" {
			current.ShortHash = line
		} else if current.AuthorName == "" {
			current.AuthorName = line
		} else if current.AuthorEmail == "" {
			current.AuthorEmail = line
		} else if current.AuthorDate.IsZero() {
			if ts, err := strconv.ParseInt(line, 10, 64); err == nil {
				current.AuthorDate = time.Unix(ts, 0)
			}
		} else if current.CommitterName == "" {
			current.CommitterName = line
		} else if current.CommitterEmail == "" {
			current.CommitterEmail = line
		} else if current.CommitterDate.IsZero() {
			if ts, err := strconv.ParseInt(line, 10, 64); err == nil {
				current.CommitterDate = time.Unix(ts, 0)
			}
		} else if len(current.Parents) == 0 && current.Subject == "" {
			if line != "" {
				current.Parents = strings.Fields(line)
				current.IsMerge = len(current.Parents) > 1
			}
		} else if current.Subject == "" {
			current.Subject = line
			inBody = true
		} else if inBody {
			if fc := parseFileChange(line); fc != nil {
				current.Files = append(current.Files, *fc)
			} else if line != "" {
				bodyLines = append(bodyLines, line)
			}
		}
	}

	if current != nil {
		current.Body = strings.Join(bodyLines, "\n")
		out <- *current
	}
}
