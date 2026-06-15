import Joi from 'joi';
import { Context, Next } from 'koa';

export const reportDisorderSchema = Joi.object({
  type: Joi.string().valid('crack', 'pothole', 'bridge_jump', 'rutting', 'other').required(),
  severity: Joi.string().valid('mild', 'moderate', 'severe', 'critical').required(),
  description: Joi.string().min(1).max(1000).required(),
  location: Joi.object({
    lat: Joi.number().min(-90).max(90).required(),
    lng: Joi.number().min(-180).max(180).required(),
    address: Joi.string().optional(),
    roadSectionId: Joi.string().optional(),
    mileage: Joi.string().optional()
  }).required(),
  images: Joi.array().items(Joi.string()).optional(),
  reporterId: Joi.string().required(),
  reporterName: Joi.string().required()
});

export const gradeDisorderSchema = Joi.object({
  severity: Joi.string().valid('mild', 'moderate', 'severe', 'critical').required(),
  gradedBy: Joi.string().required(),
  gradedName: Joi.string().optional()
});

export const createWorkOrderSchema = Joi.object({
  disorderId: Joi.string().required(),
  title: Joi.string().min(1).max(200).required(),
  description: Joi.string().min(1).max(2000).required(),
  teamId: Joi.string().required(),
  teamName: Joi.string().required(),
  assigneeId: Joi.string().required(),
  assigneeName: Joi.string().required(),
  priority: Joi.string().valid('low', 'medium', 'high', 'urgent').required(),
  estimatedHours: Joi.number().min(0).optional(),
  materials: Joi.array().items(Joi.object({
    name: Joi.string().required(),
    quantity: Joi.number().min(0).required(),
    unit: Joi.string().required()
  })).optional(),
  deadline: Joi.string().isoDate().optional()
});

export const updateStatusSchema = Joi.object({
  status: Joi.string().valid('pending', 'assigned', 'repairing', 'accepting', 'closed', 'rejected').required(),
  operatorId: Joi.string().required(),
  operatorName: Joi.string().optional(),
  remark: Joi.string().optional()
});

export const updateProgressSchema = Joi.object({
  progress: Joi.number().min(0).max(100).required(),
  repairDescription: Joi.string().optional(),
  repairImages: Joi.array().items(Joi.string()).optional(),
  actualHours: Joi.number().min(0).optional(),
  operatorId: Joi.string().required(),
  operatorName: Joi.string().optional()
});

export const submitAcceptanceSchema = Joi.object({
  result: Joi.string().valid('pass', 'fail').required(),
  remark: Joi.string().required(),
  images: Joi.array().items(Joi.string()).optional(),
  acceptorId: Joi.string().required(),
  acceptorName: Joi.string().required()
});

export const reportTrackSchema = Joi.object({
  patrolId: Joi.string().required(),
  inspectorId: Joi.string().required(),
  inspectorName: Joi.string().required(),
  lat: Joi.number().min(-90).max(90).required(),
  lng: Joi.number().min(-180).max(180).required(),
  timestamp: Joi.string().isoDate().optional(),
  speed: Joi.number().min(0).optional(),
  accuracy: Joi.number().min(0).optional()
});

function createValidator(schema: Joi.ObjectSchema) {
  return async (ctx: Context, next: Next) => {
    const { error } = schema.validate(ctx.request.body, { abortEarly: false });
    if (error) {
      ctx.status = 400;
      ctx.body = {
        code: 400,
        message: '请求参数校验失败',
        data: {
          details: error.details.map(d => ({
            field: d.path.join('.'),
            message: d.message
          }))
        },
        timestamp: Date.now()
      };
      return;
    }
    await next();
  };
}

export const validateReportDisorder = createValidator(reportDisorderSchema);
export const validateGradeDisorder = createValidator(gradeDisorderSchema);
export const validateCreateWorkOrder = createValidator(createWorkOrderSchema);
export const validateUpdateStatus = createValidator(updateStatusSchema);
export const validateUpdateProgress = createValidator(updateProgressSchema);
export const validateSubmitAcceptance = createValidator(submitAcceptanceSchema);
export const validateReportTrack = createValidator(reportTrackSchema);
