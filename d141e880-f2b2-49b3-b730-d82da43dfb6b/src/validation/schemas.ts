import { z } from 'zod';

export const artifactSchema = z.object({
  name: z.string().min(1, '遗物名称不能为空'),
  category: z.string().min(1, '请选择类别'),
  subcategory: z.string().min(1, '请选择子类'),
  quantity: z.number().int().min(1, '数量至少为1'),
  condition: z.string().min(1, '请选择保存状况'),
  depth: z.number().min(0, '深度不能为负数').max(10, '深度范围0-10米'),
  offsetX: z.number().min(0, 'X偏移不能为负数').max(5, 'X偏移超出探方范围'),
  offsetY: z.number().min(0, 'Y偏移不能为负数').max(5, 'Y偏移超出探方范围'),
  period: z.string().optional(),
  notes: z.string().optional(),
});

export const stratumSchema = z.object({
  name: z.string().min(1, '地层名称不能为空'),
  thickness: z.number().min(0.01, '厚度至少0.01米').max(5, '厚度不能超过5米'),
  soilType: z.string().min(1, '请输入土质'),
  soilColor: z.string().min(1, '请输入土色'),
  period: z.string().min(1, '请选择年代'),
  description: z.string().optional(),
});

export const siteSchema = z.object({
  name: z.string().min(1, '工地名称不能为空'),
  location: z.string().min(1, '工地位置不能为空'),
  managerId: z.string().min(1, '请选择负责人'),
  startDate: z.string().min(1, '请选择开始日期'),
  endDate: z.string().min(1, '请选择结束日期'),
  gridRows: z.number().int().min(1, '至少1行').max(20, '最多20行'),
  gridCols: z.number().int().min(1, '至少1列').max(20, '最多20列'),
  description: z.string().optional(),
});

export const gridSchema = z.object({
  status: z.enum(['unexcavated', 'excavating', 'completed']),
  recorderId: z.string().optional(),
});

export const searchSchema = z.object({
  keyword: z.string().optional(),
  category: z.string().optional(),
  period: z.string().optional(),
  siteId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const comparisonSchema = z.object({
  siteIds: z.array(z.string()).min(2, '请至少选择2个工地进行对比'),
  alignmentMethod: z.enum(['period', 'depth', 'similarity']).default('period'),
});

export type ArtifactFormData = z.infer<typeof artifactSchema>;
export type StratumFormData = z.infer<typeof stratumSchema>;
export type SiteFormData = z.infer<typeof siteSchema>;
export type SearchFilters = z.infer<typeof searchSchema>;
export type ComparisonConfig = z.infer<typeof comparisonSchema>;

export const validateArtifact = (data: unknown) => {
  return artifactSchema.safeParse(data);
};

export const validateStratum = (data: unknown) => {
  return stratumSchema.safeParse(data);
};

export const validateSite = (data: unknown) => {
  return siteSchema.safeParse(data);
};

export const validateSearch = (data: unknown) => {
  return searchSchema.safeParse(data);
};

export const validateComparison = (data: unknown) => {
  return comparisonSchema.safeParse(data);
};
