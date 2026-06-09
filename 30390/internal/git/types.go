package git

import (
	"time"
)

type Commit struct {
	Hash           string
	ShortHash      string
	AuthorName     string
	AuthorEmail    string
	AuthorDate     time.Time
	CommitterName  string
	CommitterEmail string
	CommitterDate  time.Time
	Subject        string
	Body           string
	Parents        []string
	Files          []FileChange
	IsMerge        bool
	RepoName       string
}

type FileChange struct {
	Path      string
	OldPath   string
	Status    string
	Additions int
	Deletions int
	IsBinary  bool
}

type BlameLine struct {
	LineNum    int
	Content    string
	Hash       string
	Author     string
	Email      string
	Date       time.Time
	LineNoOrig int
}

type FileBlame struct {
	Path  string
	Lines []BlameLine
}

type ReflogEntry struct {
	OldHash   string
	NewHash   string
	Action    string
	Message   string
	Timestamp time.Time
}

type RepoInfo struct {
	Name        string
	Path        string
	Mode        string
	HeadBranch  string
	HeadCommit  string
	Remotes     map[string]string
	LastCommit  time.Time
	CommitCount int
	FirstCommit time.Time
	Branches    []string
}

type HealthLevel string

const (
	HealthGood     HealthLevel = "good"
	HealthWarning  HealthLevel = "warning"
	HealthCritical HealthLevel = "critical"
)

func (l HealthLevel) String() string {
	return string(l)
}

func (l HealthLevel) Color() string {
	switch l {
	case HealthGood:
		return "green"
	case HealthWarning:
		return "yellow"
	case HealthCritical:
		return "red"
	default:
		return "gray"
	}
}

func (l HealthLevel) Emoji() string {
	switch l {
	case HealthGood:
		return "✓"
	case HealthWarning:
		return "⚠"
	case HealthCritical:
		return "✗"
	default:
		return "?"
	}
}

type Contributor struct {
	Name         string
	Email        string
	Commits      int
	LinesAdded   int
	LinesDeleted int
	FirstCommit  time.Time
	LastCommit   time.Time
}

type ContributorMatrix struct {
	Contributor string
	Weekly      map[string]int
	Monthly     map[string]int
	Quarterly   map[string]int
}
