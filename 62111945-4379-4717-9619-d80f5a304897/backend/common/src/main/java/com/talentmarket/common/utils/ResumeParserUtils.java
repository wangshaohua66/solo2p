package com.talentmarket.common.utils;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.hwpf.HWPFDocument;
import org.apache.poi.hwpf.usermodel.Range;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Component
public class ResumeParserUtils {

    @Data
    @AllArgsConstructor
    public static class ParsedResume {
        private String name;
        private String phone;
        private String email;
        private Integer age;
        private String gender;
        private String education;
        private String expectedPosition;
        private Integer expectedSalaryMin;
        private Integer expectedSalaryMax;
        private List<String> skills;
        private Integer yearsOfExperience;
        private List<String> workExperience;
        private List<String> educationExperience;
        private String rawText;
    }

    public ParsedResume parseResume(MultipartFile file) throws IOException {
        String fileName = file.getOriginalFilename();
        if (fileName == null) {
            throw new IllegalArgumentException("文件名不能为空");
        }

        String text;
        if (fileName.toLowerCase().endsWith(".pdf")) {
            text = extractTextFromPDF(file.getInputStream());
        } else if (fileName.toLowerCase().endsWith(".docx")) {
            text = extractTextFromDocx(file.getInputStream());
        } else if (fileName.toLowerCase().endsWith(".doc")) {
            text = extractTextFromDoc(file.getInputStream());
        } else {
            throw new IllegalArgumentException("不支持的文件格式，请上传PDF或Word文档");
        }

        log.info("简历解析完成，文本长度: {}", text.length());
        return parseTextToResume(text);
    }

    private String extractTextFromPDF(InputStream inputStream) throws IOException {
        try (PDDocument document = PDDocument.load(inputStream)) {
            PDFTextStripper stripper = new PDFTextStripper();
            return stripper.getText(document);
        }
    }

    private String extractTextFromDocx(InputStream inputStream) throws IOException {
        try (XWPFDocument document = new XWPFDocument(inputStream)) {
            StringBuilder text = new StringBuilder();
            for (XWPFParagraph paragraph : document.getParagraphs()) {
                text.append(paragraph.getText()).append("\n");
            }
            return text.toString();
        }
    }

    private String extractTextFromDoc(InputStream inputStream) throws IOException {
        try (HWPFDocument document = new HWPFDocument(inputStream)) {
            Range range = document.getRange();
            return range.text();
        }
    }

    private ParsedResume parseTextToResume(String text) {
        String name = extractName(text);
        String phone = extractPhone(text);
        String email = extractEmail(text);
        Integer age = extractAge(text);
        String gender = extractGender(text);
        String education = extractEducation(text);
        String expectedPosition = extractExpectedPosition(text);
        int[] expectedSalary = extractExpectedSalary(text);
        List<String> skills = extractSkills(text);
        Integer yearsOfExperience = extractYearsOfExperience(text);

        return new ParsedResume(
                name, phone, email, age, gender, education,
                expectedPosition, expectedSalary[0], expectedSalary[1],
                skills, yearsOfExperience,
                new ArrayList<>(), new ArrayList<>(),
                text
        );
    }

    private String extractName(String text) {
        Pattern pattern = Pattern.compile("姓\\s*名\\s*[：:]\\s*(\\S{2,10})");
        Matcher matcher = pattern.matcher(text);
        if (matcher.find()) {
            return matcher.group(1).trim();
        }
        
        String[] lines = text.split("\\n");
        for (String line : lines) {
            line = line.trim();
            if (line.length() >= 2 && line.length() <= 5 && 
                line.matches("^[\\u4e00-\\u9fa5]{2,5}$")) {
                return line;
            }
        }
        
        return "未知";
    }

    private String extractPhone(String text) {
        Pattern pattern = Pattern.compile("1[3-9]\\d{9}");
        Matcher matcher = pattern.matcher(text);
        if (matcher.find()) {
            return matcher.group();
        }
        return null;
    }

    private String extractEmail(String text) {
        Pattern pattern = Pattern.compile("[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}");
        Matcher matcher = pattern.matcher(text);
        if (matcher.find()) {
            return matcher.group();
        }
        return null;
    }

    private Integer extractAge(String text) {
        Pattern pattern = Pattern.compile("(\\d{2})\\s*岁");
        Matcher matcher = pattern.matcher(text);
        if (matcher.find()) {
            try {
                return Integer.parseInt(matcher.group(1));
            } catch (NumberFormatException e) {
                return null;
            }
        }
        
        Pattern birthPattern = Pattern.compile("(\\d{4})[年.-]\\s*\\d{1,2}[月.-]");
        Matcher birthMatcher = birthPattern.matcher(text);
        if (birthMatcher.find()) {
            try {
                int birthYear = Integer.parseInt(birthMatcher.group(1));
                return java.time.Year.now().getValue() - birthYear;
            } catch (NumberFormatException e) {
                return null;
            }
        }
        
        return null;
    }

    private String extractGender(String text) {
        if (text.contains("男")) {
            return "男";
        }
        if (text.contains("女")) {
            return "女";
        }
        return null;
    }

    private String extractEducation(String text) {
        if (text.contains("博士")) return "博士";
        if (text.contains("硕士") || text.contains("研究生")) return "硕士";
        if (text.contains("本科")) return "本科";
        if (text.contains("大专")) return "大专";
        if (text.contains("高中")) return "高中";
        return "不限";
    }

    private String extractExpectedPosition(String text) {
        Pattern pattern = Pattern.compile("(期望职位|求职意向|意向职位)\\s*[：:]\\s*(\\S+)");
        Matcher matcher = pattern.matcher(text);
        if (matcher.find()) {
            return matcher.group(2);
        }
        return null;
    }

    private int[] extractExpectedSalary(String text) {
        int min = 0, max = 0;
        
        Pattern pattern = Pattern.compile("(\\d+)\\s*[kK万]\\s*[-~至]\\s*(\\d+)\\s*[kK万]");
        Matcher matcher = pattern.matcher(text);
        if (matcher.find()) {
            try {
                min = Integer.parseInt(matcher.group(1)) * 1000;
                max = Integer.parseInt(matcher.group(2)) * 1000;
            } catch (NumberFormatException e) {
                // ignore
            }
        }
        
        return new int[]{min, max};
    }

    private List<String> extractSkills(String text) {
        List<String> skills = new ArrayList<>();
        
        String[] commonSkills = {
            "Java", "Python", "C++", "C#", "JavaScript", "TypeScript",
            "React", "Vue", "Angular", "Node.js", "Spring", "Spring Boot",
            "MySQL", "Oracle", "MongoDB", "Redis", "Docker", "Kubernetes",
            "Linux", "Git", "Hadoop", "Spark", "TensorFlow", "AWS",
            "产品设计", "UI设计", "运营", "市场营销", "财务", "人力资源",
            "项目管理", "数据分析", "算法", "深度学习", "机器学习"
        };

        for (String skill : commonSkills) {
            if (text.toLowerCase().contains(skill.toLowerCase())) {
                skills.add(skill);
            }
        }

        Pattern skillPattern = Pattern.compile("(技能|专业技能|技术栈)\\s*[：:](.+?)(?:\\n|\\r|$)");
        Matcher skillMatcher = skillPattern.matcher(text);
        if (skillMatcher.find()) {
            String skillLine = skillMatcher.group(2);
            String[] parts = skillLine.split("[、，,/\\s]+");
            for (String part : parts) {
                if (!part.trim().isEmpty() && !skills.contains(part.trim())) {
                    skills.add(part.trim());
                }
            }
        }

        return skills;
    }

    private Integer extractYearsOfExperience(String text) {
        Pattern pattern = Pattern.compile("(\\d+)\\s*年.*经验");
        Matcher matcher = pattern.matcher(text);
        if (matcher.find()) {
            try {
                return Integer.parseInt(matcher.group(1));
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return null;
    }
}
