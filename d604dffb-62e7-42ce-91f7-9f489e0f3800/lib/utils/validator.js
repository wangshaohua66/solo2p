import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configPath = path.resolve(__dirname, '../../config/default.json');
const config = await fs.readJson(configPath);

export const PROJECT_NAME_REGEX = /^[a-zA-Z\u4e00-\u9fa5][a-zA-Z0-9_\-\u4e00-\u9fa5]{1,49}$/;

export const SCENE_REGEX = /^[A-Za-z0-9_-]{1,20}$/;

export const SHOT_REGEX = /^[A-Za-z0-9_-]{1,20}$/;

export function validateProjectName(name) {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: '项目名称不能为空', code: 'E001' };
  }
  if (name.length < 2 || name.length > 50) {
    return { valid: false, error: '项目名称长度必须在2-50个字符之间', code: 'E001' };
  }
  if (!PROJECT_NAME_REGEX.test(name)) {
    return { valid: false, error: '项目名称只能包含中文、英文、数字、下划线和连字符，且必须以中文或英文字母开头', code: 'E001' };
  }
  return { valid: true };
}

export function validatePath(inputPath) {
  if (!inputPath || typeof inputPath !== 'string') {
    return { valid: false, error: '路径不能为空', code: 'E002' };
  }
  const resolvedPath = path.resolve(inputPath);
  if (resolvedPath.length > 255) {
    return { valid: false, error: '路径长度不能超过255个字符', code: 'E002' };
  }
  const invalidChars = /[<>:"|?*]/;
  if (invalidChars.test(inputPath)) {
    return { valid: false, error: '路径包含非法字符', code: 'E002' };
  }
  return { valid: true };
}

export function validateProjectStatus(status) {
  if (!status) {
    return { valid: false, error: '项目状态不能为空', code: 'E003' };
  }
  const validStatuses = Object.keys(config.projectStatus);
  if (!validStatuses.includes(status)) {
    return {
      valid: false,
      error: `无效的项目状态，有效值为: ${validStatuses.join(', ')}`,
      code: 'E003'
    };
  }
  return { valid: true };
}

export function validateMaterialStatus(status) {
  if (!status) {
    return { valid: false, error: '素材状态不能为空', code: 'E004' };
  }
  const validStatuses = Object.keys(config.materialStatus);
  if (!validStatuses.includes(status)) {
    return {
      valid: false,
      error: `无效的素材状态，有效值为: ${validStatuses.join(', ')}`,
      code: 'E004'
    };
  }
  return { valid: true };
}

export function validateMaterialType(type) {
  if (!type) {
    return { valid: false, error: '素材类型不能为空', code: 'E005' };
  }
  const validTypes = Object.keys(config.materialTypes);
  if (!validTypes.includes(type)) {
    return {
      valid: false,
      error: `无效的素材类型，有效值为: ${validTypes.join(', ')}`,
      code: 'E005'
    };
  }
  return { valid: true };
}

export function validateScene(scene) {
  if (!scene) {
    return { valid: false, error: '场次号不能为空', code: 'E006' };
  }
  if (!SCENE_REGEX.test(scene)) {
    return { valid: false, error: '场次号格式不正确，只能包含字母、数字、下划线和连字符，长度1-20', code: 'E006' };
  }
  return { valid: true };
}

export function validateShot(shot) {
  if (!shot) {
    return { valid: false, error: '镜头号不能为空', code: 'E007' };
  }
  if (!SHOT_REGEX.test(shot)) {
    return { valid: false, error: '镜头号格式不正确，只能包含字母、数字、下划线和连字符，长度1-20', code: 'E007' };
  }
  return { valid: true };
}

export function validateAudioFormat(filePath) {
  if (!filePath) {
    return { valid: false, error: '文件路径不能为空', code: 'E008' };
  }
  const ext = path.extname(filePath).toLowerCase();
  if (!config.supportedFormats.includes(ext)) {
    return {
      valid: false,
      error: `不支持的音频格式，支持: ${config.supportedFormats.join(', ')}`,
      code: 'E008' };
  }
  return { valid: true };
}

export function validateRole(role) {
  if (!role) {
    return { valid: false, error: '角色不能为空', code: 'E009' };
  }
  const validRoles = Object.keys(config.roles);
  if (!validRoles.includes(role)) {
    return {
      valid: false,
      error: `无效的角色，有效值为: ${validRoles.join(', ')}`,
      code: 'E009'
    };
  }
  return { valid: true };
}

export function validateDateRange(startDate, endDate) {
  if (startDate && isNaN(Date.parse(startDate))) {
    return { valid: false, error: '开始日期格式不正确', code: 'E010' };
  }
  if (endDate && isNaN(Date.parse(endDate))) {
    return { valid: false, error: '结束日期格式不正确', code: 'E010' };
  }
  if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
    return { valid: false, error: '开始日期不能晚于结束日期', code: 'E010' };
  }
  return { valid: true };
}

export function validateTimecode(timecode) {
  if (!timecode) {
    return { valid: false, error: '时间码不能为空', code: 'E011' };
  }
  const tcRegex = /^(\d{1,2}):(\d{2}):(\d{2})([:;](\d{1,3}))?$/;
  if (!tcRegex.test(timecode)) {
    return { valid: false, error: '时间码格式应为 HH:MM:SS 或 HH:MM:SS:mmm', code: 'E011' };
  }
  return { valid: true };
}

export function validateEmail(email) {
  if (!email) return { valid: true };
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, error: '邮箱格式不正确', code: 'E012' };
  }
  return { valid: true };
}
