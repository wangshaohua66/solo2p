use std::path::Path;

use anyhow::{anyhow, Result};
use quick_xml::events::{BytesStart, Event};
use quick_xml::Reader;

use crate::models::{
    Citation, Claim, ClaimType, DiagnosticSeverity, ParseDiagnostic, Patent, SourceFormat,
};

/// 单次解析结果：专利模型 + 诊断信息
#[derive(Debug, Clone)]
pub struct ParseOutcome {
    pub patent: Patent,
    pub diagnostics: Vec<ParseDiagnostic>,
}

impl ParseOutcome {
    pub fn has_errors(&self) -> bool {
        self.diagnostics
            .iter()
            .any(|d| d.severity == DiagnosticSeverity::Error)
    }
}

/// XML 解析器
pub struct XmlParser {
    pub strict: bool,
}

impl XmlParser {
    pub fn new(strict: bool) -> Self {
        Self { strict }
    }

    /// 解析单个文件：处理编码、格式识别、结构提取
    pub fn parse_file(&self, path: &Path) -> Result<ParseOutcome> {
        let raw = std::fs::read(path).map_err(|e| anyhow!("读取文件失败 {}: {}", path.display(), e))?;
        let (content, diags) = match std::str::from_utf8(&raw) {
            Ok(s) => (s.to_string(), Vec::new()),
            Err(e) => {
                let lossy = String::from_utf8_lossy(&raw).into_owned();
                let (line, col) = offset_to_line_col(&lossy, e.valid_up_to());
                let mut d = Vec::new();
                d.push(ParseDiagnostic {
                    file: Some(path.to_path_buf()),
                    line,
                    column: col,
                    severity: DiagnosticSeverity::Error,
                    message: format!("编码错误（非 UTF-8），已按 UTF-8 容错解析：{}", e),
                });
                (lossy, d)
            }
        };
        let format = detect_format(&content);
        let mut outcome = self.parse_content(&content, format, Some(path))?;
        outcome.diagnostics.splice(0..0, diags);
        if self.strict && outcome.has_errors() {
            let first = outcome
                .diagnostics
                .iter()
                .find(|d| d.severity == DiagnosticSeverity::Error)
                .unwrap();
            return Err(anyhow!("严格模式下解析失败: {}", first));
        }
        Ok(outcome)
    }

    /// 解析内存中的 XML 字符串（供测试与直接调用）
    pub fn parse_str(&self, content: &str) -> Result<ParseOutcome> {
        let format = detect_format(content);
        self.parse_content(content, format, None)
    }

    fn parse_content(
        &self,
        content: &str,
        format: SourceFormat,
        file: Option<&Path>,
    ) -> Result<ParseOutcome> {
        let mut patent = Patent::new("", format);
        patent.source_file = file.map(|p| p.to_path_buf());

        let mut reader = Reader::from_str(content);
        let mut state = ParseState::default();
        let mut buf = Vec::new();

        loop {
            let event = reader.read_event_into(&mut buf);
            match event {
                Ok(Event::Start(e)) => {
                    let name = local_name(e.name().as_ref()).to_string();
                    state.path.push(name.clone());
                    handle_start(&e, &mut patent, &mut state);
                }
                Ok(Event::Empty(e)) => {
                    let name = local_name(e.name().as_ref()).to_string();
                    state.path.push(name.clone());
                    handle_start(&e, &mut patent, &mut state);
                    handle_end(&name, &mut patent, &mut state);
                    state.path.pop();
                }
                Ok(Event::End(e)) => {
                    let name = local_name(e.name().as_ref()).to_string();
                    handle_end(&name, &mut patent, &mut state);
                    state.path.pop();
                }
                Ok(Event::Text(t)) => {
                    let decoded = t.xml_content().unwrap_or_default();
                    let text = if decoded.contains('&') {
                        quick_xml::escape::unescape(&decoded)
                            .map(|c| c.into_owned())
                            .unwrap_or_else(|_| decoded.into_owned())
                    } else {
                        decoded.into_owned()
                    };
                    let text = text.trim();
                    if !text.is_empty() {
                        handle_text(text, &mut patent, &mut state);
                    }
                }
                Ok(Event::CData(c)) => {
                    let bytes: &[u8] = c.as_ref();
                    let text = String::from_utf8_lossy(bytes);
                    let trimmed = text.trim();
                    if !trimmed.is_empty() {
                        handle_text(trimmed, &mut patent, &mut state);
                    }
                }
                Ok(Event::Eof) => break,
                Err(e) => {
                    let pos = reader.buffer_position() as usize;
                    let (line, col) = offset_to_line_col(content, pos);
                    return Ok(ParseOutcome {
                        patent,
                        diagnostics: vec![ParseDiagnostic {
                            file: file.map(|p| p.to_path_buf()),
                            line,
                            column: col,
                            severity: DiagnosticSeverity::Error,
                            message: format!("XML 语法错误: {}", e),
                        }],
                    });
                }
                _ => {}
            }
            buf.clear();
        }

        finalize_patent(&mut patent, &mut state);
        Ok(ParseOutcome {
            patent,
            diagnostics: state.diagnostics,
        })
    }
}

#[derive(Default)]
struct ParseState {
    path: Vec<String>,
    pending_claim: Option<PendingClaim>,
    pending_citation: Option<Citation>,
    diagnostics: Vec<ParseDiagnostic>,
}

struct PendingClaim {
    number: String,
    explicit_type: Option<ClaimType>,
    refs: Vec<String>,
    text: String,
}

fn local_name(name: &[u8]) -> &str {
    let s = std::str::from_utf8(name).unwrap_or("");
    match s.rfind(':') {
        Some(i) => &s[i + 1..],
        None => s,
    }
}

fn attr_map(e: &BytesStart) -> Vec<(String, String)> {
    e.attributes()
        .filter_map(|a| a.ok())
        .map(|a| {
            let k = local_name(a.key.as_ref()).to_string();
            let v = String::from_utf8_lossy(a.value.as_ref()).into_owned();
            (k, v)
        })
        .collect()
}

fn path_ends(state: &ParseState, name: &str) -> bool {
    state.path.last().map(|s| s == name).unwrap_or(false)
}

fn in_path(state: &ParseState, needle: &str) -> bool {
    state.path.iter().any(|s| s == needle)
}

fn handle_start(e: &BytesStart, patent: &mut Patent, state: &mut ParseState) {
    let name_local = e.name();
    let name = local_name(name_local.as_ref());
    let attrs = attr_map(e);

    match name {
        "中国专利文献" => {
            patent.source_format = SourceFormat::Cnipa;
        }
        "patent-document" => {
            patent.source_format = SourceFormat::Wipo;
            for (k, v) in &attrs {
                if k == "id" && patent.id.is_empty() {
                    patent.id = v.clone();
                }
            }
        }
        "权利要求" if in_path(state, "权利要求书") => {
            let number = attrs
                .iter()
                .find(|(k, _)| k == "序号")
                .map(|(_, v)| v.clone())
                .unwrap_or_default();
            let explicit_type = attrs
                .iter()
                .find(|(k, _)| k == "类型")
                .and_then(|(_, v)| match v.as_str() {
                    "独立" => Some(ClaimType::Independent),
                    "从属" => Some(ClaimType::Dependent),
                    _ => None,
                });
            let refs = attrs
                .iter()
                .find(|(k, _)| k == "引用")
                .map(|(_, v)| parse_ref_list(v))
                .unwrap_or_default();
            state.pending_claim = Some(PendingClaim {
                number,
                explicit_type,
                refs,
                text: String::new(),
            });
        }
        "claim" if in_path(state, "claims") => {
            let number = attrs
                .iter()
                .find(|(k, _)| k == "num")
                .map(|(_, v)| v.clone())
                .unwrap_or_default();
            state.pending_claim = Some(PendingClaim {
                number,
                explicit_type: None,
                refs: Vec::new(),
                text: String::new(),
            });
        }
        "引用" if in_path(state, "引用文献") => {
            let mut c = Citation {
                cited_id: String::new(),
                cited_title: None,
                category: None,
                is_non_patent: false,
            };
            for (k, v) in &attrs {
                match k.as_str() {
                    "证号" => c.cited_id = v.clone(),
                    "类别" => c.category = Some(v.clone()),
                    "类型" => c.is_non_patent = v == "非专利",
                    _ => {}
                }
            }
            state.pending_citation = Some(c);
        }
        "patcit" if in_path(state, "references-cited") => {
            let dnum = attrs.iter().find(|(k, _)| k == "dnum").map(|(_, v)| v.clone());
            let c = ensure_citation(state);
            if let Some(d) = dnum {
                c.cited_id = d;
            }
            c.is_non_patent = false;
        }
        "nplcit" if in_path(state, "references-cited") => {
            ensure_citation(state).is_non_patent = true;
        }
        "citation" if in_path(state, "references-cited") => {
            state.pending_citation = Some(Citation {
                cited_id: String::new(),
                cited_title: None,
                category: None,
                is_non_patent: false,
            });
        }
        _ => {}
    }
}

fn ensure_citation(state: &mut ParseState) -> &mut Citation {
    if state.pending_citation.is_none() {
        state.pending_citation = Some(Citation {
            cited_id: String::new(),
            cited_title: None,
            category: None,
            is_non_patent: false,
        });
    }
    state.pending_citation.as_mut().unwrap()
}

fn handle_text(text: &str, patent: &mut Patent, state: &mut ParseState) {
    if path_ends(state, "文献号") {
        patent.id = text.to_string();
        return;
    }
    if path_ends(state, "名称") {
        patent.title = text.to_string();
        return;
    }
    if path_ends(state, "摘要") {
        patent.abstract_text.push_str(text);
        return;
    }
    if path_ends(state, "申请日") {
        patent.filing_date = Some(text.to_string());
        return;
    }
    if path_ends(state, "公开日") {
        patent.publication_date = Some(text.to_string());
        return;
    }
    if path_ends(state, "申请人") {
        patent.applicants.push(text.to_string());
        return;
    }
    if path_ends(state, "发明人") {
        patent.inventors.push(text.to_string());
        return;
    }
    if path_ends(state, "分类号") {
        patent.classifications.push(text.to_string());
        return;
    }
    if path_ends(state, "引用") && in_path(state, "引用文献") {
        if let Some(c) = state.pending_citation.as_mut() {
            if c.cited_id.is_empty() {
                c.cited_id = text.to_string();
            }
        }
        return;
    }
    if path_ends(state, "invention-title") {
        patent.title = text.to_string();
        return;
    }
    if path_ends(state, "abstract") {
        patent.abstract_text.push_str(text);
        return;
    }
    if path_ends(state, "name") {
        if in_path(state, "applicants") {
            patent.applicants.push(text.to_string());
        } else if in_path(state, "inventors") {
            patent.inventors.push(text.to_string());
        }
        return;
    }
    if path_ends(state, "text") && in_path(state, "classification-ipcr") {
        patent.classifications.push(text.to_string());
        return;
    }
    if path_ends(state, "doc-number") {
        if in_path(state, "references-cited") {
            if let Some(c) = state.pending_citation.as_mut() {
                if c.cited_id.is_empty() {
                    c.cited_id = text.to_string();
                }
            }
        } else if in_path(state, "publication-reference") {
            patent.id = text.to_string();
        }
        return;
    }
    if path_ends(state, "date") {
        if in_path(state, "publication-reference") {
            patent.publication_date = Some(normalize_date(text));
        } else if in_path(state, "application-reference") {
            patent.filing_date = Some(normalize_date(text));
        }
        return;
    }
    if path_ends(state, "category") && in_path(state, "references-cited") {
        if let Some(c) = state.pending_citation.as_mut() {
            c.category = Some(text.to_string());
        }
        return;
    }
    if path_ends(state, "claim-text")
        || (path_ends(state, "权利要求") && in_path(state, "权利要求书"))
    {
        if let Some(pc) = state.pending_claim.as_mut() {
            if !pc.text.is_empty() {
                pc.text.push(' ');
            }
            pc.text.push_str(text);
        }
    }
}

fn handle_end(name: &str, patent: &mut Patent, state: &mut ParseState) {
    match name {
        "权利要求" if in_path(state, "权利要求书") => {
            if let Some(pc) = state.pending_claim.take() {
                patent.claims.push(build_claim(pc));
            }
        }
        "claim" if in_path(state, "claims") => {
            if let Some(pc) = state.pending_claim.take() {
                patent.claims.push(build_claim(pc));
            }
        }
        "引用" if in_path(state, "引用文献") => {
            push_citation_or_warn(patent, state);
        }
        "citation" if in_path(state, "references-cited") => {
            push_citation_or_warn(patent, state);
        }
        _ => {}
    }
}

fn push_citation_or_warn(patent: &mut Patent, state: &mut ParseState) {
    if let Some(c) = state.pending_citation.take() {
        if !c.cited_id.is_empty() {
            patent.citations.push(c);
        } else {
            state.diagnostics.push(ParseDiagnostic {
                file: patent.source_file.clone(),
                line: 0,
                column: 0,
                severity: DiagnosticSeverity::Warning,
                message: "引用文献缺少文献号，已跳过".to_string(),
            });
        }
    }
}

fn build_claim(pc: PendingClaim) -> Claim {
    let mut text = pc.text.trim().to_string();
    if let Some(rest) = strip_leading_number(&text) {
        text = rest.trim_start().to_string();
    }
    let mut deps = pc.refs;
    if deps.is_empty() {
        deps = extract_claim_refs(&text);
    }
    let claim_type = if !deps.is_empty() {
        ClaimType::Dependent
    } else {
        pc.explicit_type.unwrap_or(ClaimType::Independent)
    };
    let number = if pc.number.is_empty() {
        extract_leading_number(&text).unwrap_or_default()
    } else {
        pc.number
    };
    Claim {
        number,
        text,
        claim_type,
        depends_on: deps,
        features: Vec::new(),
    }
}

fn finalize_patent(patent: &mut Patent, state: &mut ParseState) {
    if patent.id.is_empty() {
        patent.id = patent
            .source_file
            .as_ref()
            .and_then(|p| p.file_stem())
            .and_then(|s| s.to_str())
            .unwrap_or("UNKNOWN")
            .to_string();
        state.diagnostics.push(ParseDiagnostic {
            file: patent.source_file.clone(),
            line: 0,
            column: 0,
            severity: DiagnosticSeverity::Warning,
            message: "未找到文献号，已使用文件名作为标识".to_string(),
        });
    }
    patent.classifications.sort();
    patent.classifications.dedup();
}

/// 格式自动识别
pub fn detect_format(content: &str) -> SourceFormat {
    if content.contains("中国专利文献") || content.contains("权利要求书") || content.contains("文献号") {
        return SourceFormat::Cnipa;
    }
    if content.contains("patent-document")
        || content.contains("references-cited")
        || content.contains("claim-text")
        || content.contains("classification-ipcr")
    {
        return SourceFormat::Wipo;
    }
    SourceFormat::Unknown
}

fn normalize_date(s: &str) -> String {
    let t = s.trim();
    if t.len() == 8 && t.chars().all(|c| c.is_ascii_digit()) {
        format!("{}-{}-{}", &t[0..4], &t[4..6], &t[6..8])
    } else {
        t.to_string()
    }
}

fn strip_leading_number(s: &str) -> Option<String> {
    let mut end = 0;
    for c in s.chars() {
        if c.is_ascii_digit() {
            end += c.len_utf8();
        } else {
            break;
        }
    }
    if end == 0 {
        return None;
    }
    let rest = &s[end..];
    let rest = rest.trim_start_matches(['.', ' ', '\t', '、']);
    if rest.is_empty() {
        None
    } else {
        Some(rest.to_string())
    }
}

fn extract_leading_number(s: &str) -> Option<String> {
    let mut num = String::new();
    for c in s.chars() {
        if c.is_ascii_digit() {
            num.push(c);
        } else {
            break;
        }
    }
    if num.is_empty() {
        None
    } else {
        Some(num)
    }
}

/// 解析 "1,2、3和4" 形式的引用列表
fn parse_ref_list(s: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut cur = String::new();
    for c in s.chars() {
        if c.is_ascii_digit() {
            cur.push(c);
        } else if !cur.is_empty() {
            out.push(std::mem::take(&mut cur));
        }
    }
    if !cur.is_empty() {
        out.push(cur);
    }
    out
}

/// 从权利要求正文提取所引用的在先权利要求编号
/// 支持 "claim 1", "claims 1 and 2", "权利要求1、2和3"
pub fn extract_claim_refs(text: &str) -> Vec<String> {
    let chars: Vec<char> = text.chars().collect();
    let n = chars.len();
    let mut refs = Vec::new();
    let mut i = 0;
    while i < n {
        if i + 4 < n {
            let s: String = chars[i..i + 5].iter().collect();
            if s.eq_ignore_ascii_case("claim") {
                i += 5;
                if i < n && chars[i] == 's' {
                    i += 1;
                }
                collect_refs(&chars, &mut i, &mut refs);
                continue;
            }
        }
        if i + 3 < n {
            let s: String = chars[i..i + 4].iter().collect();
            if s == "权利要求" {
                i += 4;
                if i < n && chars[i] == '书' {
                    i += 1;
                }
                collect_refs(&chars, &mut i, &mut refs);
                continue;
            }
        }
        i += 1;
    }
    refs
}

fn collect_refs(chars: &[char], i: &mut usize, refs: &mut Vec<String>) {
    let n = chars.len();
    loop {
        while *i < n && chars[*i].is_whitespace() {
            *i += 1;
        }
        if *i >= n {
            break;
        }
        let c = chars[*i];
        if c == ',' || c == '、' {
            *i += 1;
            continue;
        }
        if *i + 2 < n {
            let s: String = chars[*i..*i + 3].iter().collect();
            if s.eq_ignore_ascii_case("and") {
                *i += 3;
                continue;
            }
        }
        if c == '和' || c == '与' || c == '或' {
            *i += 1;
            continue;
        }
        if c.is_ascii_digit() {
            let mut num = String::new();
            while *i < n && chars[*i].is_ascii_digit() {
                num.push(chars[*i]);
                *i += 1;
            }
            refs.push(num);
            continue;
        }
        break;
    }
}

/// 字节偏移 → (行, 列)
pub fn offset_to_line_col(src: &str, offset: usize) -> (usize, usize) {
    let mut line = 1usize;
    let mut col = 1usize;
    for (i, b) in src.bytes().enumerate() {
        if i >= offset {
            break;
        }
        if b == b'\n' {
            line += 1;
            col = 1;
        } else {
            col += 1;
        }
    }
    (line, col)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    const CNIPA_SAMPLE: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
<中国专利文献>
  <文献号>CN101010101A</文献号>
  <申请日>2009-01-01</申请日>
  <公开日>2010-01-01</公开日>
  <名称>一种杠杆装置</名称>
  <摘要>本发明涉及一种杠杆装置。</摘要>
  <申请人>张三</申请人>
  <申请人>李四有限公司</申请人>
  <发明人>王五</发明人>
  <分类号>B25J9/00</分类号>
  <分类号>B25J11/00</分类号>
  <引用文献>
    <引用 证号="CN200888888A" 类别="Y"/>
    <引用 证号="CN200777777A" 类别="A"/>
  </引用文献>
  <权利要求书>
    <权利要求 序号="1" 类型="独立">
      一种杠杆装置，包括底座和杠杆，其特征在于所述杠杆可转动地连接于底座。
    </权利要求>
    <权利要求 序号="2" 类型="从属" 引用="1">
      如权利要求1所述的装置，其特征在于所述杠杆由钢制成。
    </权利要求>
    <权利要求 序号="3" 类型="从属" 引用="2">
      如权利要求2所述的装置，其特征在于所述杠杆表面镀有铬层。
    </权利要求>
  </权利要求书>
</中国专利文献>"#;

    const WIPO_SAMPLE: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
<patent-document id="WO2020123456A1" lang="en" dtd-version="ST.36-v1.4">
  <bibliographic-data>
    <publication-reference><document-id><doc-number>WO2020123456A1</doc-number><date>20200618</date></document-id></publication-reference>
    <application-reference><document-id><doc-number>PCT/IB2019/000123</doc-number><date>20191218</date></document-id></application-reference>
    <invention-title lang="en">A widget assembly</invention-title>
    <abstract lang="en">An improved widget assembly with a pivotable lever.</abstract>
    <parties>
      <applicants><applicant sequence="1"><addressbook><name>Acme Corp</name></addressbook></applicant></applicants>
      <inventors><inventor sequence="1"><addressbook><name>John Doe</name></addressbook></inventor></inventors>
    </parties>
    <classification-ipcr><text>B25J9/00</text></classification-ipcr>
    <references-cited>
      <citation>
        <patcit dnum="US2010111111A1"><document-id><doc-number>US2010111111A1</doc-number></document-id></patcit>
        <category>Y</category>
      </citation>
    </references-cited>
  </bibliographic-data>
  <claims>
    <claim id="c0001" num="1">
      <claim-text>1. A widget assembly comprising a base and a lever, wherein the lever is pivotably attached to the base.</claim-text>
    </claim>
    <claim id="c0002" num="2">
      <claim-text>2. The widget assembly of claim 1, wherein the lever is made of steel.</claim-text>
    </claim>
  </claims>
</patent-document>"#;

    #[test]
    fn detect_cnipa_and_wipo() {
        assert_eq!(detect_format(CNIPA_SAMPLE), SourceFormat::Cnipa);
        assert_eq!(detect_format(WIPO_SAMPLE), SourceFormat::Wipo);
    }

    #[test]
    fn parse_cnipa_sample() {
        let parser = XmlParser::new(false);
        let outcome = parser.parse_str(CNIPA_SAMPLE).unwrap();
        let p = &outcome.patent;
        assert_eq!(p.source_format, SourceFormat::Cnipa);
        assert_eq!(p.id, "CN101010101A");
        assert_eq!(p.title, "一种杠杆装置");
        assert_eq!(p.applicants.len(), 2);
        assert_eq!(p.classifications.len(), 2);
        assert_eq!(p.citations.len(), 2);
        assert_eq!(p.citations[0].cited_id, "CN200888888A");
        assert_eq!(p.claims.len(), 3);
        assert!(p.claims[0].is_independent());
        assert_eq!(p.claims[1].depends_on, vec!["1".to_string()]);
        assert_eq!(p.claims[2].depends_on, vec!["2".to_string()]);
    }

    #[test]
    fn parse_wipo_sample() {
        let parser = XmlParser::new(false);
        let outcome = parser.parse_str(WIPO_SAMPLE).unwrap();
        let p = &outcome.patent;
        assert_eq!(p.source_format, SourceFormat::Wipo);
        assert_eq!(p.id, "WO2020123456A1");
        assert_eq!(p.title, "A widget assembly");
        assert_eq!(p.applicants, vec!["Acme Corp".to_string()]);
        assert_eq!(p.publication_date.as_deref(), Some("2020-06-18"));
        assert_eq!(p.filing_date.as_deref(), Some("2019-12-18"));
        assert_eq!(p.citations.len(), 1);
        assert_eq!(p.citations[0].cited_id, "US2010111111A1");
        assert_eq!(p.citations[0].category.as_deref(), Some("Y"));
        assert_eq!(p.claims.len(), 2);
        assert!(p.claims[0].is_independent());
        assert_eq!(p.claims[1].depends_on, vec!["1".to_string()]);
        assert!(!p.claims[1].text.starts_with("2."));
    }

    #[test]
    fn extract_refs_multilingual() {
        assert_eq!(extract_claim_refs("of claim 1, wherein"), vec!["1"]);
        assert_eq!(extract_claim_refs("of claims 1 and 2, wherein"), vec!["1", "2"]);
        assert_eq!(extract_claim_refs("如权利要求1、2和3所述"), vec!["1", "2", "3"]);
        assert!(extract_claim_refs("an independent method").is_empty());
    }

    #[test]
    fn encoding_error_records_diagnostic() {
        let tmp = tempfile::NamedTempFile::new().unwrap();
        tmp.as_file().write_all(b"\xFF\xFF<root/>").unwrap();
        let parser = XmlParser::new(false);
        let outcome = parser.parse_file(tmp.path()).unwrap();
        assert!(outcome.has_errors());
        assert!(outcome.diagnostics[0].line >= 1);
    }

    #[test]
    fn empty_content_uses_unknown_id() {
        let parser = XmlParser::new(false);
        let outcome = parser.parse_str("").unwrap();
        assert_eq!(outcome.patent.id, "UNKNOWN");
        assert!(!outcome.diagnostics.is_empty());
    }
}
