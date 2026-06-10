package report

import (
	"fmt"
	"strings"

	"github.com/gitmon/gitmon/internal/storage"
)

type chartColors struct {
	good     string
	warning  string
	critical string
	primary  string
	grid     string
	text     string
}

var lightColors = chartColors{
	good:     "#10b981",
	warning:  "#f59e0b",
	critical: "#ef4444",
	primary:  "#6366f1",
	grid:     "#e5e7eb",
	text:     "#374151",
}

var darkColors = chartColors{
	good:     "#34d399",
	warning:  "#fbbf24",
	critical: "#f87171",
	primary:  "#818cf8",
	grid:     "#374151",
	text:     "#e5e7eb",
}

func getHealthColor(score float64, colors chartColors) string {
	if score >= 80 {
		return colors.good
	} else if score >= 50 {
		return colors.warning
	}
	return colors.critical
}

func RenderHealthBarSVG(stats []storage.RepoStats, width, height int, darkMode bool) string {
	colors := lightColors
	if darkMode {
		colors = darkColors
	}

	barWidth := 40
	barGap := 20
	chartPadding := 60
	maxHeight := height - chartPadding*2

	maxScore := 100.0

	var sortedStats []storage.RepoStats
	for _, s := range stats {
		sortedStats = append(sortedStats, s)
	}
	for i := 0; i < len(sortedStats)-1; i++ {
		for j := i + 1; j < len(sortedStats); j++ {
			if sortedStats[i].HealthScore < sortedStats[j].HealthScore {
				sortedStats[i], sortedStats[j] = sortedStats[j], sortedStats[i]
			}
		}
	}

	totalWidth := chartPadding*2 + len(sortedStats)*(barWidth+barGap)
	if totalWidth < width {
		totalWidth = width
	}

	var svg strings.Builder
	svg.WriteString(fmt.Sprintf(`<svg width="%d" height="%d" viewBox="0 0 %d %d" xmlns="http://www.w3.org/2000/svg">`, width, height, totalWidth, height))

	svg.WriteString(fmt.Sprintf(`<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="%s" stroke-width="1"/>`,
		chartPadding, height-chartPadding, totalWidth-chartPadding, height-chartPadding, colors.grid))
	for i := 0; i <= 5; i++ {
		y := float64(chartPadding) + float64(maxHeight)*float64(i)/5
		svg.WriteString(fmt.Sprintf(`<line x1="%d" y1="%.0f" x2="%d" y2="%.0f" stroke="%s" stroke-width="0.5" stroke-dasharray="4,4"/>`,
			chartPadding, y, totalWidth-chartPadding, y, colors.grid))
		svg.WriteString(fmt.Sprintf(`<text x="%d" y="%.0f" fill="%s" font-size="10" text-anchor="end" dominant-baseline="middle">%d</text>`,
			chartPadding-5, y, colors.text, 100-i*20))
	}

	for i, s := range sortedStats {
		x := chartPadding + i*(barWidth+barGap)
		barHeight := int(float64(maxHeight) * s.HealthScore / maxScore)
		y := height - chartPadding - barHeight
		color := getHealthColor(s.HealthScore, colors)

		svg.WriteString(fmt.Sprintf(`<rect x="%d" y="%d" width="%d" height="%d" fill="%s" rx="4"/>`,
			x, y, barWidth, barHeight, color))

		svg.WriteString(fmt.Sprintf(`<text x="%d" y="%d" fill="%s" font-size="11" font-weight="bold" text-anchor="middle" dominant-baseline="auto">%.0f</text>`,
			x+barWidth/2, y-5, colors.text, s.HealthScore))

		svg.WriteString(fmt.Sprintf(`<text x="%d" y="%d" fill="%s" font-size="10" text-anchor="middle" dominant-baseline="hanging" transform="rotate(-45 %d %d)">%s</text>`,
			x+barWidth/2, height-chartPadding+5, colors.text, x+barWidth/2, height-chartPadding+5, s.RepoName))
	}

	svg.WriteString(`</svg>`)
	return svg.String()
}

func RenderTrendSVG(stats []storage.RepoStats, width, height int, darkMode bool) string {
	colors := lightColors
	if darkMode {
		colors = darkColors
	}

	chartPadding := 60
	maxHeight := height - chartPadding*2

	var sortedStats []storage.RepoStats
	for _, s := range stats {
		sortedStats = append(sortedStats, s)
	}
	for i := 0; i < len(sortedStats)-1; i++ {
		for j := i + 1; j < len(sortedStats); j++ {
			if sortedStats[i].TotalCommits < sortedStats[j].TotalCommits {
				sortedStats[i], sortedStats[j] = sortedStats[j], sortedStats[i]
			}
		}
	}

	maxCommits := 0
	for _, s := range sortedStats {
		if s.TotalCommits > maxCommits {
			maxCommits = s.TotalCommits
		}
	}
	if maxCommits == 0 {
		maxCommits = 1
	}

	barWidth := 40
	barGap := 20
	totalWidth := chartPadding*2 + len(sortedStats)*(barWidth+barGap)
	if totalWidth < width {
		totalWidth = width
	}

	var svg strings.Builder
	svg.WriteString(fmt.Sprintf(`<svg width="%d" height="%d" viewBox="0 0 %d %d" xmlns="http://www.w3.org/2000/svg">`, width, height, totalWidth, height))

	svg.WriteString(fmt.Sprintf(`<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="%s" stroke-width="1"/>`,
		chartPadding, height-chartPadding, totalWidth-chartPadding, height-chartPadding, colors.grid))

	steps := 5
	for i := 0; i <= steps; i++ {
		y := float64(chartPadding) + float64(maxHeight)*float64(i)/float64(steps)
		value := maxCommits - (maxCommits * i / steps)
		svg.WriteString(fmt.Sprintf(`<line x1="%d" y1="%.0f" x2="%d" y2="%.0f" stroke="%s" stroke-width="0.5" stroke-dasharray="4,4"/>`,
			chartPadding, y, totalWidth-chartPadding, y, colors.grid))
		svg.WriteString(fmt.Sprintf(`<text x="%d" y="%.0f" fill="%s" font-size="10" text-anchor="end" dominant-baseline="middle">%d</text>`,
			chartPadding-5, y, colors.text, value))
	}

	var pathPoints []string
	var areaPoints []string
	for i, s := range sortedStats {
		x := chartPadding + i*(barWidth+barGap) + barWidth/2
		barHeight := int(float64(maxHeight) * float64(s.TotalCommits) / float64(maxCommits))
		y := height - chartPadding - barHeight
		pathPoints = append(pathPoints, fmt.Sprintf("%d,%d", x, y))
		if i == 0 {
			areaPoints = append(areaPoints, fmt.Sprintf("%d,%d", x, height-chartPadding))
		}
		areaPoints = append(areaPoints, fmt.Sprintf("%d,%d", x, y))
		if i == len(sortedStats)-1 {
			areaPoints = append(areaPoints, fmt.Sprintf("%d,%d", x, height-chartPadding))
		}
	}

	areaPath := strings.Join(areaPoints, " ")
	svg.WriteString(fmt.Sprintf(`<polygon points="%s" fill="%s" fill-opacity="0.2"/>`, areaPath, colors.primary))

	linePath := "M " + strings.Join(pathPoints, " L ")
	svg.WriteString(fmt.Sprintf(`<path d="%s" fill="none" stroke="%s" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`,
		linePath, colors.primary))

	for i, s := range sortedStats {
		x := chartPadding + i*(barWidth+barGap) + barWidth/2
		barHeight := int(float64(maxHeight) * float64(s.TotalCommits) / float64(maxCommits))
		y := height - chartPadding - barHeight

		svg.WriteString(fmt.Sprintf(`<circle cx="%d" cy="%d" r="4" fill="%s" stroke="white" stroke-width="2"/>`,
			x, y, colors.primary))

		svg.WriteString(fmt.Sprintf(`<text x="%d" y="%d" fill="%s" font-size="10" font-weight="bold" text-anchor="middle" dominant-baseline="auto">%d</text>`,
			x, y-10, colors.text, s.TotalCommits))

		svg.WriteString(fmt.Sprintf(`<text x="%d" y="%d" fill="%s" font-size="10" text-anchor="middle" dominant-baseline="hanging" transform="rotate(-45 %d %d)">%s</text>`,
			x, height-chartPadding+5, colors.text, x, height-chartPadding+5, s.RepoName))
	}

	svg.WriteString(`</svg>`)
	return svg.String()
}

func RenderBusFactorBar(alerts []storage.AlertRecord, width, height int, darkMode bool) string {
	colors := lightColors
	if darkMode {
		colors = darkColors
	}

	typeCount := make(map[string]int)
	for _, a := range alerts {
		if !a.Resolved {
			typeCount[a.Type]++
		}
	}

	var types []string
	var counts []int
	for t, c := range typeCount {
		types = append(types, t)
		counts = append(counts, c)
	}
	for i := 0; i < len(counts)-1; i++ {
		for j := i + 1; j < len(counts); j++ {
			if counts[i] < counts[j] {
				counts[i], counts[j] = counts[j], counts[i]
				types[i], types[j] = types[j], types[i]
			}
		}
	}

	if len(types) == 0 {
		return fmt.Sprintf(`<svg width="%d" height="%d" xmlns="http://www.w3.org/2000/svg"><text x="%d" y="%d" fill="%s" font-size="14" text-anchor="middle" dominant-baseline="middle">No active alerts</text></svg>`,
			width, height, width/2, height/2, colors.text)
	}

	chartPadding := 80
	maxHeight := height - chartPadding*2
	barWidth := 50
	barGap := 30
	totalWidth := chartPadding*2 + len(types)*(barWidth+barGap)
	if totalWidth < width {
		totalWidth = width
	}

	maxCount := 0
	for _, c := range counts {
		if c > maxCount {
			maxCount = c
		}
	}
	if maxCount == 0 {
		maxCount = 1
	}

	var svg strings.Builder
	svg.WriteString(fmt.Sprintf(`<svg width="%d" height="%d" viewBox="0 0 %d %d" xmlns="http://www.w3.org/2000/svg">`, width, height, totalWidth, height))

	svg.WriteString(fmt.Sprintf(`<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="%s" stroke-width="1"/>`,
		chartPadding, height-chartPadding, totalWidth-chartPadding, height-chartPadding, colors.grid))

	for i, t := range types {
		x := chartPadding + i*(barWidth+barGap)
		barHeight := int(float64(maxHeight) * float64(counts[i]) / float64(maxCount))
		y := height - chartPadding - barHeight
		color := colors.primary
		if counts[i] > 5 {
			color = colors.critical
		} else if counts[i] > 2 {
			color = colors.warning
		}

		innerRadius := float64(barWidth) * 0.4
		outerRadius := float64(barWidth) * 0.8
		centerX := float64(x + barWidth/2)
		centerY := float64(y + barHeight/2)

		svg.WriteString(fmt.Sprintf(`<circle cx="%.1f" cy="%.1f" r="%.1f" fill="%s" fill-opacity="0.2"/>`,
			centerX, centerY, outerRadius, color))
		svg.WriteString(fmt.Sprintf(`<circle cx="%.1f" cy="%.1f" r="%.1f" fill="%s"/>`,
			centerX, centerY, innerRadius, color))

		svg.WriteString(fmt.Sprintf(`<text x="%.1f" y="%.1f" fill="white" font-size="14" font-weight="bold" text-anchor="middle" dominant-baseline="middle">%d</text>`,
			centerX, centerY, counts[i]))

		displayName := t
		switch t {
		case "bus_factor":
			displayName = "Bus Factor"
		case "staleness":
			displayName = "Staleness"
		case "high_churn":
			displayName = "High Churn"
		case "complexity":
			displayName = "Complexity"
		case "silent_repo":
			displayName = "Silent Repo"
		case "tech_debt":
			displayName = "Tech Debt"
		}

		svg.WriteString(fmt.Sprintf(`<text x="%.1f" y="%d" fill="%s" font-size="11" font-weight="500" text-anchor="middle" dominant-baseline="hanging" transform="rotate(-45 %.1f %d)">%s</text>`,
			centerX, height-chartPadding+5, colors.text, centerX, height-chartPadding+5, displayName))
	}

	svg.WriteString(`</svg>`)
	return svg.String()
}
