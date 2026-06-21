package main

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"text/tabwriter"
	"time"

	"pavement/internal/engine"
	"pavement/internal/errors"
	"pavement/internal/export"
	"pavement/internal/parser"
	"pavement/internal/storage"
	"pavement/internal/validator"
)

const (
	ColorRed     = "\033[31m"
	ColorGreen   = "\033[32m"
	ColorYellow  = "\033[33m"
	ColorBlue    = "\033[34m"
	ColorMagenta = "\033[35m"
	ColorCyan    = "\033[36m"
	ColorBold    = "\033[1m"
	ColorReset   = "\033[0m"
)

var (
	globalVerbose bool
	globalQuiet   bool
	dbPath        string
)

type CommandHandler func(args []string) error

type CLI struct {
	commands map[string]CommandHandler
}

func main() {
	cli := &CLI{
		commands: make(map[string]CommandHandler),
	}
	cli.registerCommands()

	if len(os.Args) < 2 {
		cli.printUsage()
		os.Exit(1)
	}

	remainingArgs := parseGlobalFlags(os.Args[1:])

	if len(remainingArgs) == 0 {
		cli.printUsage()
		os.Exit(1)
	}

	cmdName := remainingArgs[0]
	if cmdName == "--help" || cmdName == "-h" || cmdName == "help" {
		cli.printUsage()
		os.Exit(0)
	}
	if cmdName == "--version" || cmdName == "-v" {
		printVersion()
		os.Exit(0)
	}

	handler, exists := cli.commands[cmdName]
	if !exists {
		printError(fmt.Sprintf("未知的子命令: %s", cmdName))
		cli.printUsage()
		os.Exit(1)
	}

	cmdArgs := remainingArgs[1:]
	if err := handler(cmdArgs); err != nil {
		printError(err.Error())
		os.Exit(1)
	}
}

func parseGlobalFlags(args []string) []string {
	remaining := make([]string, 0)
	for i := 0; i < len(args); i++ {
		switch {
		case args[i] == "--verbose":
			globalVerbose = true
		case args[i] == "--quiet":
			globalQuiet = true
		case strings.HasPrefix(args[i], "--db="):
			dbPath = strings.TrimPrefix(args[i], "--db=")
		case args[i] == "--db" && i+1 < len(args):
			dbPath = args[i+1]
			i++
		case args[i] == "--help" || args[i] == "-h" || args[i] == "help":
			remaining = append(remaining, args[i])
		case args[i] == "--version" || args[i] == "-v":
			remaining = append(remaining, args[i])
		default:
			remaining = append(remaining, args[i])
		}
	}
	if dbPath == "" {
		dbPath = "./pavement.db"
	}
	return remaining
}

func (c *CLI) registerCommands() {
	c.commands["import"] = c.cmdImport
	c.commands["classify"] = c.cmdClassify
	c.commands["query"] = c.cmdQuery
	c.commands["rank"] = c.cmdRank
	c.commands["budget"] = c.cmdBudget
	c.commands["export"] = c.cmdExport
	c.commands["stats"] = c.cmdStats
	c.commands["delete"] = c.cmdDelete
}

func (c *CLI) printUsage() {
	fmt.Println()
	fmt.Printf("%s%s pavement - 国省干线路面病害检测与养护管理系统 %s\n", ColorBold, ColorCyan, ColorReset)
	fmt.Println()
	fmt.Println("用法:")
	fmt.Println("  pavement [全局选项] <子命令> [选项] [参数]")
	fmt.Println()
	fmt.Println("全局选项:")
	fmt.Println("  -h, --help       显示帮助信息")
	fmt.Println("  -v, --version    显示版本号")
	fmt.Println("      --verbose    显示详细执行日志")
	fmt.Println("      --quiet      仅输出结果，不显示中间信息")
	fmt.Println("      --db <路径>  指定数据库文件路径 (默认: ./pavement.db)")
	fmt.Println()
	fmt.Println("子命令:")
	fmt.Printf("  %s%-12s%s  %s\n", ColorGreen, "import", ColorReset, "批量导入CSV检测文件")
	fmt.Printf("  %s%-12s%s  %s\n", ColorGreen, "classify", ColorReset, "执行病害等级智能判定")
	fmt.Printf("  %s%-12s%s  %s\n", ColorGreen, "query", ColorReset, "多条件组合查询路段")
	fmt.Printf("  %s%-12s%s  %s\n", ColorGreen, "rank", ColorReset, "养护优先级排序 Top50")
	fmt.Printf("  %s%-12s%s  %s\n", ColorGreen, "budget", ColorReset, "预算分配方案计算")
	fmt.Printf("  %s%-12s%s  %s\n", ColorGreen, "export", ColorReset, "导出Markdown养护方案报告")
	fmt.Printf("  %s%-12s%s  %s\n", ColorGreen, "stats", ColorReset, "三维度数据统计分析")
	fmt.Printf("  %s%-12s%s  %s\n", ColorGreen, "delete", ColorReset, "批量删除历史数据")
	fmt.Println()
	fmt.Println("示例:")
	fmt.Println("  pavement import -d ./data/q1 -b Q1-2024")
	fmt.Println("  pavement classify --all")
	fmt.Println("  pavement query -r G108 -s K100+000 -e K150+000 -g 差")
	fmt.Println("  pavement rank --top 50")
	fmt.Println("  pavement budget --total 5000000")
	fmt.Println("  pavement export -o report.md")
	fmt.Println("  pavement stats --dim all")
	fmt.Println("  pavement delete --batch Q1-2023")
	fmt.Println()
}

func printVersion() {
	fmt.Printf("%s%spavement CLI v1.0.0%s\n", ColorBold, ColorCyan, ColorReset)
	fmt.Println("JTG H20-2018 公路技术状况评定标准")
	fmt.Println("Copyright (c) 2024 省级公路管理局养护科")
}

func getDB() (*storage.Database, error) {
	return storage.NewDatabase(dbPath)
}

func logVerbose(format string, args ...interface{}) {
	if globalVerbose && !globalQuiet {
		msg := fmt.Sprintf(format, args...)
		fmt.Printf("%s[DEBUG]%s %s\n", ColorBlue, ColorReset, msg)
	}
}

func logInfo(format string, args ...interface{}) {
	if !globalQuiet {
		fmt.Printf("%s[INFO]%s ", ColorCyan, ColorReset)
		fmt.Printf(format+"\n", args...)
	}
}

func printSuccess(format string, args ...interface{}) {
	fmt.Printf("%s[✓ SUCCESS]%s ", ColorGreen, ColorReset)
	fmt.Printf(format+"\n", args...)
}

func printWarning(format string, args ...interface{}) {
	fmt.Printf("%s[! WARNING]%s ", ColorYellow, ColorReset)
	fmt.Printf(format+"\n", args...)
}

func printError(format string, args ...interface{}) {
	fmt.Fprintf(os.Stderr, "%s[✗ ERROR]%s ", ColorRed, ColorReset)
	fmt.Fprintf(os.Stderr, format+"\n", args...)
}

func newTableWriter() *tabwriter.Writer {
	return tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
}

func gradeColor(grade string) string {
	switch grade {
	case "优":
		return ColorGreen
	case "良":
		return ColorCyan
	case "中":
		return ColorYellow
	case "差":
		return ColorRed
	default:
		return ColorReset
	}
}

func (c *CLI) cmdImport(args []string) error {
	args = parseGlobalFlags(args)
	fs := flag.NewFlagSet("import", flag.ExitOnError)
	dirPath := fs.String("dir", "", "CSV文件所在目录路径 (必填)")
	dirShort := fs.String("d", "", "CSV文件所在目录路径 (短参数)")
	batchID := fs.String("batch", "", "批次号，不指定则自动生成")
	batchShort := fs.String("b", "", "批次号 (短参数)")
	showDetails := fs.Bool("details", false, "显示导入失败的详细记录")
	fs.Parse(args)

	if *dirPath == "" && *dirShort != "" {
		dirPath = dirShort
	}
	if *batchID == "" && *batchShort != "" {
		batchID = batchShort
	}

	if err := validator.ValidateImportPath(*dirPath); err != nil {
		return err
	}

	logInfo("开始扫描目录: %s", *dirPath)
	startTime := time.Now()

	csvParser := parser.NewCSVParser()
	result, err := csvParser.ImportFromDir(*dirPath)
	if err != nil {
		return err
	}

	records := csvParser.GetParsedRecords(result)

	if *batchID != "" {
		for _, r := range records {
			r.BatchID = strings.ToUpper(*batchID)
		}
		result.SuccessBatchIDs = []string{strings.ToUpper(*batchID)}
	}

	logVerbose("解析完成: 成功文件 %d, 失败文件 %d, 成功记录 %d, 失败记录 %d",
		result.SuccessFiles, result.FailedFiles,
		result.SuccessRecords, result.FailedRecords)

	logInfo("开始写入数据库...")
	db, err := getDB()
	if err != nil {
		return err
	}
	defer db.Close()

	inserted, err := db.BatchInsertRecords(records)
	if err != nil {
		return err
	}

	elapsed := time.Since(startTime)
	successRate := 0.0
	if result.TotalRecords > 0 {
		successRate = float64(result.SuccessRecords) / float64(result.TotalRecords) * 100
	}

	fmt.Println()
	fmt.Printf("%s==========  数据导入结果  ==========%s\n", ColorBold+ColorCyan, ColorReset)
	w := newTableWriter()
	fmt.Fprintf(w, "  扫描文件总数\t%d\t\n", result.TotalFiles)
	fmt.Fprintf(w, "  成功导入文件\t%d\t\n", result.SuccessFiles)
	fmt.Fprintf(w, "  失败文件数\t%d\t\n", result.FailedFiles)
	fmt.Fprintf(w, "  总记录数\t%d\t\n", result.TotalRecords)
	fmt.Fprintf(w, "  成功记录数\t%d\t\n", inserted)
	fmt.Fprintf(w, "  失败记录数\t%d\t\n", result.FailedRecords)
	fmt.Fprintf(w, "  导入成功率\t%.2f%%\t\n", successRate)
	fmt.Fprintf(w, "  关联批次号\t%s\t\n", strings.Join(result.SuccessBatchIDs, ", "))
	fmt.Fprintf(w, "  耗时\t%s\t\n", elapsed.Round(time.Millisecond))
	w.Flush()
	fmt.Println()

	if *showDetails && len(result.FailedDetails) > 0 {
		printWarning("失败明细 (前20条):")
		w2 := newTableWriter()
		fmt.Fprintf(w2, "  文件名\t行号\t失败原因\n")
		showCount := len(result.FailedDetails)
		if showCount > 20 {
			showCount = 20
		}
		for i := 0; i < showCount; i++ {
			d := result.FailedDetails[i]
			fmt.Fprintf(w2, "  %s\t%d\t%s\n", filepath.Base(d.FileName), d.RowNumber, d.Reason)
		}
		w2.Flush()
		fmt.Println()
	}

	printSuccess("数据导入完成，共写入 %d 条记录", inserted)
	return nil
}

func (c *CLI) cmdClassify(args []string) error {
	args = parseGlobalFlags(args)
	fs := flag.NewFlagSet("classify", flag.ExitOnError)
	classifyAll := fs.Bool("all", false, "对所有未判定的记录执行判定")
	batchID := fs.String("batch", "", "按批次号判定")
	routeID := fs.String("route", "", "按路线编号判定")
	routeShort := fs.String("r", "", "按路线编号判定 (短参数)")
	iriW := fs.Float64("iri-weight", 0.40, "IRI权重 (0-1)")
	rutW := fs.Float64("rut-weight", 0.30, "车辙深度权重 (0-1)")
	crackW := fs.Float64("crack-weight", 0.30, "裂缝密度权重 (0-1)")
	fs.Parse(args)

	if *routeID == "" && *routeShort != "" {
		routeID = routeShort
	}

	db, err := getDB()
	if err != nil {
		return err
	}
	defer db.Close()

	classifier := engine.NewDiseaseClassifier()
	if err := classifier.SetCustomWeights(*iriW, *rutW, *crackW); err != nil {
		printWarning("自定义权重设置失败: %v，使用默认权重", err)
		classifier = engine.NewDiseaseClassifier()
	}

	cond := &storage.QueryCondition{}
	if !*classifyAll && *batchID == "" && *routeID == "" {
		return errors.NewClassifyError(
			errors.ErrClassifyMissingData,
			"缺少判定范围条件",
			"请指定 --all 全量判定，或 --batch 批次号，或 -r 路线编号",
			nil,
		)
	}

	if *batchID != "" {
		cond.RouteID = ""
	}
	if *routeID != "" {
		cond.RouteID = strings.ToUpper(*routeID)
	}
	cond.Limit = 0

	logInfo("查询待判定的记录...")
	records, err := db.QueryRecords(cond)
	if err != nil {
		return err
	}

	needClassify := make([]*storage.PavementRecord, 0)
	for _, r := range records {
		if r.IRIScore == 0 || r.RutScore == 0 || r.CrackScore == 0 || r.DiseaseGrade == "中" {
			needClassify = append(needClassify, r)
		}
	}

	if *classifyAll {
		needClassify = records
	}

	if len(needClassify) == 0 {
		printWarning("没有需要进行判定的记录")
		return nil
	}

	logInfo("待判定记录数: %d，开始执行病害等级判定...", len(needClassify))
	startTime := time.Now()

	success, failed := classifier.BatchClassify(needClassify)

	updateCount := 0
	for _, r := range needClassify {
		err := db.UpdateRecordClassify(r.ID, r.IRIScore, r.RutScore, r.CrackScore, r.TotalScore, r.DiseaseGrade)
		if err == nil {
			updateCount++
		}
	}

	elapsed := time.Since(startTime)
	avgPerRecord := time.Duration(0)
	if len(needClassify) > 0 {
		avgPerRecord = elapsed / time.Duration(len(needClassify))
	}

	gradeStats := map[string]int{"优": 0, "良": 0, "中": 0, "差": 0}
	for _, r := range needClassify {
		gradeStats[r.DiseaseGrade]++
	}

	fmt.Println()
	fmt.Printf("%s==========  病害等级判定结果  ==========%s\n", ColorBold+ColorCyan, ColorReset)
	w := newTableWriter()
	fmt.Fprintf(w, "  判定总记录\t%d\t\n", len(needClassify))
	fmt.Fprintf(w, "  判定成功\t%d\t\n", success)
	fmt.Fprintf(w, "  判定失败\t%d\t\n", failed)
	fmt.Fprintf(w, "  数据库更新成功\t%d\t\n", updateCount)
	fmt.Fprintf(w, "  总耗时\t%s\t\n", elapsed.Round(time.Millisecond))
	fmt.Fprintf(w, "  单条平均耗时\t%s\t\n", avgPerRecord.Round(time.Microsecond))
	w.Flush()

	fmt.Println()
	fmt.Println("  病害等级分布:")
	w2 := newTableWriter()
	for _, grade := range []string{"优", "良", "中", "差"} {
		count := gradeStats[grade]
		ratio := 0.0
		if len(needClassify) > 0 {
			ratio = float64(count) / float64(len(needClassify)) * 100
		}
		fmt.Fprintf(w2, "    %s%s%s\t%d 段\t%.2f%%\n",
			gradeColor(grade), grade, ColorReset, count, ratio)
	}
	w2.Flush()
	fmt.Println()

	printSuccess("病害等级判定完成，已更新 %d 条记录的判定结果", updateCount)
	return nil
}

func (c *CLI) cmdQuery(args []string) error {
	args = parseGlobalFlags(args)
	fs := flag.NewFlagSet("query", flag.ExitOnError)
	routeID := fs.String("route", "", "路线编号，如 G108")
	routeShort := fs.String("r", "", "路线编号 (短参数)")
	startStation := fs.String("start", "", "起始桩号，如 K100+000")
	startShort := fs.String("s", "", "起始桩号 (短参数)")
	endStation := fs.String("end", "", "终止桩号，如 K150+000")
	endShort := fs.String("e", "", "终止桩号 (短参数)")
	grade := fs.String("grade", "", "病害等级: 优/良/中/差")
	gradeShort := fs.String("g", "", "病害等级 (短参数)")
	startDate := fs.String("from", "", "起始日期 YYYY-MM-DD")
	endDate := fs.String("to", "", "终止日期 YYYY-MM-DD")
	limit := fs.Int("limit", 500, "最大返回记录数")
	limitShort := fs.Int("l", 500, "最大返回记录数 (短参数)")
	fs.Parse(args)

	if *routeID == "" && *routeShort != "" {
		routeID = routeShort
	}
	if *startStation == "" && *startShort != "" {
		startStation = startShort
	}
	if *endStation == "" && *endShort != "" {
		endStation = endShort
	}
	if *grade == "" && *gradeShort != "" {
		grade = gradeShort
	}
	if *limit == 500 && *limitShort != 500 {
		limit = limitShort
	}

	params := &validator.QueryParams{
		RouteID:      strings.ToUpper(*routeID),
		StartStation: *startStation,
		EndStation:   *endStation,
		Grade:        validator.NormalizeGrade(*grade),
		StartDate:    *startDate,
		EndDate:      *endDate,
	}

	if err := validator.ValidateQueryParams(params); err != nil {
		return err
	}

	db, err := getDB()
	if err != nil {
		return err
	}
	defer db.Close()

	cond := &storage.QueryCondition{
		RouteID: params.RouteID,
		Grade:   params.Grade,
		Limit:   *limit,
	}

	if params.StartStation != "" {
		st, _ := validator.ParseStationToMeters(params.StartStation)
		cond.StartStation = &st
	}
	if params.EndStation != "" {
		ed, _ := validator.ParseStationToMeters(params.EndStation)
		cond.EndStation = &ed
	}
	if params.StartDate != "" {
		sd, _ := validator.ParseDate(params.StartDate)
		cond.StartDate = &sd
	}
	if params.EndDate != "" {
		ed, _ := validator.ParseDate(params.EndDate)
		cond.EndDate = &ed
	}

	logInfo("执行查询...")
	startTime := time.Now()
	records, err := db.QueryRecords(cond)
	if err != nil {
		return err
	}
	elapsed := time.Since(startTime)

	fmt.Println()
	fmt.Printf("%s==========  查询结果  ==========%s\n", ColorBold+ColorCyan, ColorReset)
	fmt.Printf("  返回记录数: %s%d%s | 耗时: %s%s%s\n",
		ColorGreen, len(records), ColorReset,
		ColorYellow, elapsed.Round(time.Millisecond), ColorReset)
	fmt.Println()

	if len(records) == 0 {
		printWarning("没有找到符合条件的记录")
		return nil
	}

	w := newTableWriter()
	headers := []string{"ID", "路线", "起止桩号", "长度(km)", "IRI", "车辙(mm)", "裂缝(%)", "PCI", "等级", "检测日期", "养护中心"}
	fmt.Fprintf(w, "  %s\n", strings.Join(headers, "\t"))
	fmt.Fprintf(w, "  %s\n", strings.Repeat("-\t", len(headers)))

	for _, r := range records {
		stationRange := fmt.Sprintf("%s ~ %s",
			validator.FormatMetersToStation(r.StartStation),
			validator.FormatMetersToStation(r.EndStation))
		dateStr := r.DetectDate.Format("2006-01-02")
		gradeColored := fmt.Sprintf("%s%s%s", gradeColor(r.DiseaseGrade), r.DiseaseGrade, ColorReset)
		fmt.Fprintf(w, "  %d\t%s\t%s\t%.3f\t%.2f\t%.1f\t%.2f\t%.1f\t%s\t%s\t%s\n",
			r.ID, r.RouteID, stationRange, r.SectionLength,
			r.IRI, r.RutDepth, r.CrackDensity,
			r.TotalScore, gradeColored, dateStr, r.MaintenanceCenter)
	}
	w.Flush()
	fmt.Println()
	printSuccess("查询完成，共返回 %d 条记录", len(records))
	return nil
}

func (c *CLI) cmdRank(args []string) error {
	args = parseGlobalFlags(args)
	fs := flag.NewFlagSet("rank", flag.ExitOnError)
	topN := fs.Int("top", 50, "返回Top N优先级路段")
	topShort := fs.Int("n", 50, "返回Top N (短参数)")
	gradeW := fs.Float64("grade-weight", engine.DefaultGradeWeight, "病害等级权重")
	trafficW := fs.Float64("traffic-weight", engine.DefaultTrafficWeight, "交通流量权重")
	importanceW := fs.Float64("importance-weight", engine.DefaultImportanceWeight, "重要性权重")
	costW := fs.Float64("cost-weight", engine.DefaultCostWeight, "成本效益权重")
	fs.Parse(args)

	if *topN == 50 && *topShort != 50 {
		topN = topShort
	}

	db, err := getDB()
	if err != nil {
		return err
	}
	defer db.Close()

	sorter := engine.NewPrioritySorter()
	if err := sorter.SetWeights(*gradeW, *trafficW, *importanceW, *costW); err != nil {
		printWarning("权重设置失败: %v，使用默认权重", err)
		sorter = engine.NewPrioritySorter()
	}

	logInfo("查询所有记录进行优先级计算...")
	allRecords, err := db.QueryRecords(&storage.QueryCondition{Limit: 0})
	if err != nil {
		return err
	}

	if len(allRecords) == 0 {
		return errors.NewPriorityError(
			errors.ErrPriorityNoData,
			"数据库中没有记录",
			"请先使用 import 命令导入检测数据",
			nil,
		)
	}

	logInfo("共 %d 条记录，开始计算优先级评分...", len(allRecords))
	startTime := time.Now()

	needCalc := make([]*storage.PavementRecord, 0)
	for _, r := range allRecords {
		if r.PriorityScore == 0 || r.EstimatedCost == 0 {
			needCalc = append(needCalc, r)
		}
	}

	if len(needCalc) > 0 {
		success, failed := sorter.BatchCalculate(needCalc)
		updateCount := 0
		for _, r := range needCalc {
			err := db.UpdatePriorityAndCost(r.ID, r.PriorityScore, r.EstimatedCost)
			if err == nil {
				updateCount++
			}
		}
		logVerbose("新计算 %d 条: 成功 %d, 失败 %d, 数据库更新 %d",
			len(needCalc), success, failed, updateCount)
	}

	elapsed := time.Since(startTime)
	logInfo("计算完成，耗时 %s", elapsed.Round(time.Millisecond))

	logInfo("获取 Top %d 高优先级路段...", *topN)
	topRecords, err := db.GetTopPriorityRecords(*topN)
	if err != nil {
		return err
	}

	results := sorter.SortByPriority(topRecords, *topN)

	fmt.Println()
	fmt.Printf("%s==========  养护优先级排序 (Top %d)  ==========%s\n", ColorBold+ColorCyan, *topN, ColorReset)
	fmt.Printf("  权重配置: 等级=%.2f | 交通=%.2f | 重要性=%.2f | 成本=%.2f\n",
		*gradeW, *trafficW, *importanceW, *costW)
	fmt.Println()

	w := newTableWriter()
	headers := []string{"排名", "路线", "起止桩号", "长度", "等级", "PCI", "优先级", "预估费用(元)", "优先级描述"}
	fmt.Fprintf(w, "  %s\n", strings.Join(headers, "\t"))
	fmt.Fprintf(w, "  %s\n", strings.Repeat("-\t", len(headers)))

	totalCost := 0.0
	for _, pr := range results {
		r := pr.Record
		stationRange := fmt.Sprintf("%s ~ %s",
			validator.FormatMetersToStation(r.StartStation),
			validator.FormatMetersToStation(r.EndStation))
		gradeColored := fmt.Sprintf("%s%s%s", gradeColor(r.DiseaseGrade), r.DiseaseGrade, ColorReset)
		prioColor := sorter.GetPriorityColor(pr.PriorityScore)
		prioColored := fmt.Sprintf("%s%.2f%s", prioColor, pr.PriorityScore, ColorReset)
		totalCost += pr.EstimatedCost
		fmt.Fprintf(w, "  %d\t%s\t%s\t%.2fkm\t%s\t%.1f\t%s\t%.2f\t%s\n",
			pr.Rank, r.RouteID, stationRange, r.SectionLength,
			gradeColored, r.TotalScore, prioColored,
			pr.EstimatedCost, sorter.GetPriorityDescription(pr.PriorityScore))
	}
	w.Flush()
	fmt.Println()

	fmt.Printf("  Top %d 预估总养护费用: %s¥%.2f%s\n",
		len(results), ColorGreen, totalCost, ColorReset)
	fmt.Println()

	printSuccess("优先级排序完成，Top %d 已输出", len(results))
	return nil
}

func (c *CLI) cmdBudget(args []string) error {
	args = parseGlobalFlags(args)
	fs := flag.NewFlagSet("budget", flag.ExitOnError)
	totalBudget := fs.Float64("total", 0, "总预算金额（元），必填")
	totalShort := fs.Float64("t", 0, "总预算金额 (短参数)")
	gradeW := fs.Float64("grade-weight", engine.DefaultGradeWeight, "病害等级权重")
	trafficW := fs.Float64("traffic-weight", engine.DefaultTrafficWeight, "交通流量权重")
	importanceW := fs.Float64("importance-weight", engine.DefaultImportanceWeight, "重要性权重")
	costW := fs.Float64("cost-weight", engine.DefaultCostWeight, "成本效益权重")
	fs.Parse(args)

	if *totalBudget == 0 && *totalShort != 0 {
		totalBudget = totalShort
	}

	if err := validator.ValidateBudget(*totalBudget); err != nil {
		return err
	}
	if *totalBudget == 0 {
		return errors.NewBudgetError(
			errors.ErrBudgetNegativeAmount,
			"总预算金额不能为空",
			"请使用 --total 或 -t 参数指定总预算金额",
			nil,
		)
	}

	db, err := getDB()
	if err != nil {
		return err
	}
	defer db.Close()

	sorter := engine.NewPrioritySorter()
	sorter.SetWeights(*gradeW, *trafficW, *importanceW, *costW)

	logInfo("查询所有记录用于预算分配...")
	allRecords, err := db.QueryRecords(&storage.QueryCondition{Limit: 0})
	if err != nil {
		return err
	}

	if len(allRecords) == 0 {
		return errors.NewBudgetError(
			errors.ErrBudgetNoValidSection,
			"数据库中没有记录",
			"请先导入检测数据并执行病害判定",
			nil,
		)
	}

	for _, r := range allRecords {
		if r.PriorityScore == 0 {
			sorter.CalculatePriority(r)
			db.UpdatePriorityAndCost(r.ID, r.PriorityScore, r.EstimatedCost)
		}
	}

	startTime := time.Now()
	logInfo("开始按优先级分配预算: %.2f 元", *totalBudget)
	plan, err := sorter.AllocateBudget(allRecords, *totalBudget)
	if err != nil {
		return err
	}
	elapsed := time.Since(startTime)

	fmt.Println()
	fmt.Printf("%s==========  预算分配方案  ==========%s\n", ColorBold+ColorCyan, ColorReset)
	fmt.Printf("  计算耗时: %s\n\n", elapsed.Round(time.Millisecond))

	w := newTableWriter()
	fmt.Fprintf(w, "  %s总预算%s\t%s¥%.2f%s\t\n", ColorBold, ColorReset, ColorGreen, plan.TotalBudget, ColorReset)
	fmt.Fprintf(w, "  %s已分配%s\t%s¥%.2f%s (%.2f%%)\t\n", ColorBold, ColorReset,
		ColorBlue, plan.AllocatedBudget, ColorReset,
		plan.AllocatedBudget/plan.TotalBudget*100)
	fmt.Fprintf(w, "  %s剩余预算%s\t%s¥%.2f%s\t\n", ColorBold, ColorReset,
		ColorYellow, plan.RemainingBudget, ColorReset)
	fmt.Fprintf(w, "  %s全额资助%s\t%d 段\t\n", ColorBold, ColorReset, plan.FundedCount)
	fmt.Fprintf(w, "  %s部分资助%s\t%d 段\t\n", ColorBold, ColorReset, plan.PartiallyFunded)
	fmt.Fprintf(w, "  %s预算不足%s\t%d 段\t\n", ColorBold, ColorReset, plan.UnfundedCount)
	w.Flush()
	fmt.Println()

	fmt.Println("  资金分配明细:")
	w2 := newTableWriter()
	headers := []string{"路线", "起止桩号", "等级", "长度", "优先级", "预估(元)", "分配(元)", "资助%", "状态"}
	fmt.Fprintf(w2, "  %s\n", strings.Join(headers, "\t"))
	fmt.Fprintf(w2, "  %s\n", strings.Repeat("-\t", len(headers)))

	for _, alloc := range plan.Allocations {
		if alloc.AllocatedFund == 0 && alloc.FundingStatus == "预算不足" && plan.RemainingBudget <= 0 {
			continue
		}
		stationRange := fmt.Sprintf("%s ~ %s", alloc.StartStation, alloc.EndStation)
		gradeColored := fmt.Sprintf("%s%s%s", gradeColor(alloc.DiseaseGrade), alloc.DiseaseGrade, ColorReset)
		statusColor := ColorGreen
		if alloc.FundingStatus == "部分资助" {
			statusColor = ColorYellow
		} else if alloc.FundingStatus != "全额资助" {
			statusColor = ColorRed
		}
		statusColored := fmt.Sprintf("%s%s%s", statusColor, alloc.FundingStatus, ColorReset)
		fmt.Fprintf(w2, "  %s\t%s\t%s\t%.2fkm\t%.2f\t%.2f\t%.2f\t%.1f%%\t%s\n",
			alloc.RouteID, stationRange, gradeColored,
			alloc.SectionLength, alloc.PriorityScore,
			alloc.EstimatedCost, alloc.AllocatedFund,
			alloc.FundingRatio, statusColored)
	}
	w2.Flush()
	fmt.Println()

	printSuccess("预算分配方案计算完成")
	return nil
}

func (c *CLI) cmdExport(args []string) error {
	args = parseGlobalFlags(args)
	fs := flag.NewFlagSet("export", flag.ExitOnError)
	outputPath := fs.String("output", "", "输出文件路径 (必填)")
	outputShort := fs.String("o", "", "输出文件路径 (短参数)")
	fromDate := fs.String("from", "", "统计起始日期")
	toDate := fs.String("to", "", "统计终止日期")
	topN := fs.Int("top", 50, "包含的优先级Top N")
	withBudget := fs.Bool("with-budget", true, "是否包含预算分配方案")
	totalBudget := fs.Float64("total-budget", 0, "用于报告的总预算，0则不显示预算部分")
	fs.Parse(args)

	if *outputPath == "" && *outputShort != "" {
		outputPath = outputShort
	}

	if *outputPath == "" {
		return errors.NewExportError(
			errors.ErrExportWriteFailed,
			"缺少输出文件路径",
			"请使用 --output 或 -o 参数指定输出Markdown文件路径",
			nil,
		)
	}

	db, err := getDB()
	if err != nil {
		return err
	}
	defer db.Close()

	cond := &storage.QueryCondition{Limit: 0}
	if *fromDate != "" {
		sd, _ := validator.ParseDate(*fromDate)
		cond.StartDate = &sd
	}
	if *toDate != "" {
		ed, _ := validator.ParseDate(*toDate)
		cond.EndDate = &ed
	}

	logInfo("查询所有记录...")
	records, err := db.QueryRecords(cond)
	if err != nil {
		return err
	}

	if len(records) == 0 {
		return errors.NewExportError(
			errors.ErrExportEmptyData,
			"没有可导出的记录数据",
			"请先导入检测数据并执行病害判定",
			nil,
		)
	}

	logInfo("获取三维度统计数据...")
	statsByRoute, _ := db.GetStatisticsByRoute()
	statsByCenter, _ := db.GetStatisticsByCenter()
	statsByGrade, _ := db.GetStatisticsByGrade()

	sorter := engine.NewPrioritySorter()

	logInfo("计算优先级 Top %d...", *topN)
	topRecords, _ := db.GetTopPriorityRecords(*topN)
	for _, r := range topRecords {
		if r.PriorityScore == 0 {
			sorter.CalculatePriority(r)
		}
	}
	priorityResults := sorter.SortByPriority(topRecords, *topN)

	var budgetPlan *engine.BudgetPlan
	if *withBudget && *totalBudget > 0 {
		for _, r := range records {
			if r.PriorityScore == 0 {
				sorter.CalculatePriority(r)
			}
		}
		budgetPlan, _ = sorter.AllocateBudget(records, *totalBudget)
	}

	logInfo("生成报告并写入: %s", *outputPath)
	generator := export.NewReportGenerator()
	savedPath, err := generator.GenerateMaintenanceReport(
		records, budgetPlan,
		statsByRoute, statsByCenter, statsByGrade,
		priorityResults, *outputPath,
	)
	if err != nil {
		return err
	}

	absPath, _ := filepath.Abs(savedPath)
	printSuccess("报告已成功导出: %s", absPath)
	fmt.Printf("  文件大小约: %s%d KB%s\n", ColorCyan, estimateFileSize(savedPath)/1024, ColorReset)
	return nil
}

func (c *CLI) cmdStats(args []string) error {
	args = parseGlobalFlags(args)
	fs := flag.NewFlagSet("stats", flag.ExitOnError)
	dimension := fs.String("dim", "all", "统计维度: route/center/grade/all")
	dimShort := fs.String("d", "all", "统计维度 (短参数)")
	output := fs.String("output", "", "导出到Markdown文件")
	outputShort := fs.String("o", "", "导出文件路径 (短参数)")
	fs.Parse(args)

	if *dimension == "all" && *dimShort != "all" {
		dimension = dimShort
	}
	if *output == "" && *outputShort != "" {
		output = outputShort
	}

	db, err := getDB()
	if err != nil {
		return err
	}
	defer db.Close()

	totalRecords, _ := db.GetAllRecordsCount()
	totalMileage, _ := db.GetTotalMileage()

	fmt.Println()
	fmt.Printf("%s==========  数据统计报表  ==========%s\n", ColorBold+ColorCyan, ColorReset)
	fmt.Println()
	fmt.Printf("  总记录数: %s%d%s 条  |  总里程: %s%.2f%s km\n\n",
		ColorGreen, totalRecords, ColorReset,
		ColorGreen, totalMileage, ColorReset)

	dim := strings.ToLower(*dimension)
	var statsByRoute, statsByCenter, statsByGrade []*storage.StatisticsResult

	if dim == "route" || dim == "all" {
		logInfo("按路线维度统计...")
		statsByRoute, err = db.GetStatisticsByRoute()
		if err != nil {
			return err
		}
	}
	if dim == "center" || dim == "all" {
		logInfo("按养护中心维度统计...")
		statsByCenter, err = db.GetStatisticsByCenter()
		if err != nil {
			return err
		}
	}
	if dim == "grade" || dim == "all" {
		logInfo("按病害等级维度统计...")
		statsByGrade, err = db.GetStatisticsByGrade()
		if err != nil {
			return err
		}
	}

	if dim == "route" || dim == "all" {
		fmt.Printf("%s【按路线分布】%s\n", ColorBlue, ColorReset)
		if len(statsByRoute) == 0 {
			printWarning("  暂无数据")
		} else {
			w := newTableWriter()
			fmt.Fprintf(w, "  路线\t路段数\t里程(km)\t占比\t优\t良\t中\t差\n")
			fmt.Fprintf(w, "  %s\n", strings.Repeat("-\t", 8))
			for _, s := range statsByRoute {
				fmt.Fprintf(w, "  %s\t%d\t%.2f\t%.2f%%\t%d\t%d\t%d\t%d\n",
					s.Value, s.SectionCount, s.TotalMileage, s.MileageRatio,
					s.Excellent, s.Good, s.Medium, s.Poor)
			}
			w.Flush()
		}
		fmt.Println()
	}

	if dim == "center" || dim == "all" {
		fmt.Printf("%s【按养护中心分布】%s\n", ColorBlue, ColorReset)
		if len(statsByCenter) == 0 {
			printWarning("  暂无数据")
		} else {
			w := newTableWriter()
			fmt.Fprintf(w, "  养护中心\t路段数\t里程(km)\t占比\t优\t良\t中\t差\n")
			fmt.Fprintf(w, "  %s\n", strings.Repeat("-\t", 8))
			for _, s := range statsByCenter {
				fmt.Fprintf(w, "  %s\t%d\t%.2f\t%.2f%%\t%d\t%d\t%d\t%d\n",
					s.Value, s.SectionCount, s.TotalMileage, s.MileageRatio,
					s.Excellent, s.Good, s.Medium, s.Poor)
			}
			w.Flush()
		}
		fmt.Println()
	}

	if dim == "grade" || dim == "all" {
		fmt.Printf("%s【按病害等级分布】%s\n", ColorBlue, ColorReset)
		if len(statsByGrade) == 0 {
			printWarning("  暂无数据")
		} else {
			w := newTableWriter()
			fmt.Fprintf(w, "  等级\t路段数\t里程(km)\t占比\n")
			fmt.Fprintf(w, "  %s\n", strings.Repeat("-\t", 4))
			for _, s := range statsByGrade {
				colored := fmt.Sprintf("%s%s%s", gradeColor(s.Value), s.Value, ColorReset)
				fmt.Fprintf(w, "  %s\t%d\t%.2f\t%.2f%%\n",
					colored, s.SectionCount, s.TotalMileage, s.MileageRatio)
			}
			w.Flush()
		}
		fmt.Println()
	}

	if *output != "" {
		generator := export.NewReportGenerator()
		savedPath, err := generator.GenerateStatisticsReport(
			statsByRoute, statsByCenter, statsByGrade, *output)
		if err != nil {
			return err
		}
		absPath, _ := filepath.Abs(savedPath)
		printSuccess("统计报告已导出: %s", absPath)
	}

	printSuccess("数据统计完成")
	return nil
}

func (c *CLI) cmdDelete(args []string) error {
	args = parseGlobalFlags(args)
	fs := flag.NewFlagSet("delete", flag.ExitOnError)
	batchID := fs.String("batch", "", "按批次号删除")
	batchShort := fs.String("b", "", "按批次号删除 (短参数)")
	fromDate := fs.String("from", "", "起始日期 YYYY-MM-DD")
	fromShort := fs.String("f", "", "起始日期 (短参数)")
	toDate := fs.String("to", "", "终止日期 YYYY-MM-DD")
	toShort := fs.String("t", "", "终止日期 (短参数)")
	confirm := fs.Bool("yes", false, "确认删除，无需交互确认")
	fs.Parse(args)

	if *batchID == "" && *batchShort != "" {
		batchID = batchShort
	}
	if *fromDate == "" && *fromShort != "" {
		fromDate = fromShort
	}
	if *toDate == "" && *toShort != "" {
		toDate = toShort
	}

	params := &validator.DeleteParams{
		BatchID:   strings.ToUpper(*batchID),
		StartDate: *fromDate,
		EndDate:   *toDate,
	}
	if err := validator.ValidateDeleteParams(params); err != nil {
		return err
	}

	db, err := getDB()
	if err != nil {
		return err
	}
	defer db.Close()

	totalRecordsBefore, _ := db.GetAllRecordsCount()
	fmt.Printf("  当前数据库共有 %s%d%s 条记录\n", ColorYellow, totalRecordsBefore, ColorReset)

	deletedCount := int64(0)

	if params.BatchID != "" {
		fmt.Printf("  将删除批次号为 %s%s%s 的所有记录\n", ColorRed, params.BatchID, ColorReset)
		if !*confirm {
			fmt.Printf("  请确认继续? (y/N): ")
			var input string
			fmt.Scanln(&input)
			if strings.ToLower(input) != "y" && strings.ToLower(input) != "yes" {
				printWarning("已取消删除操作")
				return nil
			}
		}
		logInfo("执行按批次号删除...")
		n, err := db.DeleteByBatchID(params.BatchID)
		if err != nil {
			return err
		}
		deletedCount = n
	}

	if params.StartDate != "" && params.EndDate != "" {
		sd, _ := validator.ParseDate(params.StartDate)
		ed, _ := validator.ParseDate(params.EndDate)
		fmt.Printf("  将删除 %s 到 %s 期间的记录\n",
			sd.Format("2006-01-02"), ed.Format("2006-01-02"))
		if !*confirm && params.BatchID == "" {
			fmt.Printf("  请确认继续? (y/N): ")
			var input string
			fmt.Scanln(&input)
			if strings.ToLower(input) != "y" && strings.ToLower(input) != "yes" {
				printWarning("已取消删除操作")
				return nil
			}
		}
		logInfo("执行按日期范围删除...")
		n, err := db.DeleteByDateRange(sd, ed)
		if err != nil {
			return err
		}
		deletedCount += n
	}

	totalRecordsAfter, _ := db.GetAllRecordsCount()
	fmt.Println()
	fmt.Printf("%s==========  删除结果  ==========%s\n", ColorBold+ColorCyan, ColorReset)
	w := newTableWriter()
	fmt.Fprintf(w, "  删除前记录数\t%d\t\n", totalRecordsBefore)
	fmt.Fprintf(w, "  删除记录数\t%d\t\n", deletedCount)
	fmt.Fprintf(w, "  删除后记录数\t%d\t\n", totalRecordsAfter)
	w.Flush()
	fmt.Println()

	printSuccess("批量删除完成，共删除 %d 条记录", deletedCount)
	return nil
}

func estimateFileSize(path string) int64 {
	info, err := os.Stat(path)
	if err != nil {
		return 0
	}
	return info.Size()
}
