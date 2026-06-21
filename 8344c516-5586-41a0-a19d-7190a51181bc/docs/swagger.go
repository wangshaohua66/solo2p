package docs

import "github.com/swaggo/swag"

const docTemplate = `{
    "schemes": {{ marshal .Schemes }},
    "swagger": "2.0",
    "info": {
        "description": "{{escape .Description}}",
        "title": "{{.Title}}",
        "contact": {},
        "version": "{{.Version}}"
    },
    "host": "{{.Host}}",
    "basePath": "{{.BasePath}}",
    "paths": {
        "/api/auth/login": {
            "post": {
                "description": "用户登录获取Token",
                "consumes": ["application/json"],
                "produces": ["application/json"],
                "tags": ["认证"],
                "parameters": [
                    {
                        "description": "登录信息",
                        "name": "body",
                        "in": "body",
                        "required": true,
                        "schema": {
                            "type": "object",
                            "properties": {
                                "username": {"type": "string", "example": "admin"},
                                "password": {"type": "string", "example": "123456"}
                            }
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "登录成功",
                        "schema": {
                            "type": "object",
                            "properties": {
                                "code": {"type": "integer", "example": 200},
                                "message": {"type": "string", "example": "success"},
                                "data": {
                                    "type": "object",
                                    "properties": {
                                        "token": {"type": "string"},
                                        "user": {
                                            "type": "object",
                                            "properties": {
                                                "id": {"type": "integer"},
                                                "username": {"type": "string"},
                                                "name": {"type": "string"},
                                                "role": {"type": "string"},
                                                "roleName": {"type": "string"}
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        "/api/auth/register": {
            "post": {
                "description": "考生自助注册",
                "consumes": ["application/json"],
                "produces": ["application/json"],
                "tags": ["认证"],
                "parameters": [
                    {
                        "description": "注册信息",
                        "name": "body",
                        "in": "body",
                        "required": true,
                        "schema": {
                            "type": "object",
                            "properties": {
                                "username": {"type": "string"},
                                "password": {"type": "string"},
                                "name": {"type": "string"},
                                "phone": {"type": "string"},
                                "idCard": {"type": "string"}
                            }
                        }
                    }
                ],
                "responses": {
                    "200": {"description": "注册成功"}
                }
            }
        },
        "/api/exams": {
            "get": {
                "security": [{"Bearer": []}],
                "description": "获取考期列表",
                "produces": ["application/json"],
                "tags": ["考期管理"],
                "parameters": [
                    {"name": "page", "in": "query", "type": "integer", "default": 1},
                    {"name": "pageSize", "in": "query", "type": "integer", "default": 20},
                    {"name": "institutionId", "in": "query", "type": "integer"},
                    {"name": "tradeId", "in": "query", "type": "integer"},
                    {"name": "status", "in": "query", "type": "integer"}
                ],
                "responses": {"200": {"description": "成功"}}
            },
            "post": {
                "security": [{"Bearer": []}],
                "description": "提交考期申请",
                "consumes": ["application/json"],
                "produces": ["application/json"],
                "tags": ["考期管理"],
                "parameters": [
                    {
                        "name": "body",
                        "in": "body",
                        "required": true,
                        "schema": {
                            "type": "object",
                            "properties": {
                                "institutionId": {"type": "integer"},
                                "tradeId": {"type": "integer"},
                                "level": {"type": "integer", "enum": [1,2,3]},
                                "examType": {"type": "integer"},
                                "candidateNum": {"type": "integer"},
                                "expectedStart": {"type": "string", "format": "date-time"},
                                "expectedEnd": {"type": "string", "format": "date-time"},
                                "remark": {"type": "string"}
                            }
                        }
                    }
                ],
                "responses": {"200": {"description": "成功"}}
            }
        },
        "/api/exams/{id}": {
            "get": {
                "security": [{"Bearer": []}],
                "description": "获取考期详情",
                "produces": ["application/json"],
                "tags": ["考期管理"],
                "parameters": [{"name": "id", "in": "path", "type": "integer", "required": true}],
                "responses": {"200": {"description": "成功"}}
            },
            "put": {
                "security": [{"Bearer": []}],
                "description": "更新考期",
                "consumes": ["application/json"],
                "produces": ["application/json"],
                "tags": ["考期管理"],
                "parameters": [
                    {"name": "id", "in": "path", "type": "integer", "required": true}
                ],
                "responses": {"200": {"description": "成功"}}
            }
        },
        "/api/exams/{id}/conflicts": {
            "get": {
                "security": [{"Bearer": []}],
                "description": "检测考期冲突",
                "produces": ["application/json"],
                "tags": ["考期管理"],
                "parameters": [{"name": "id", "in": "path", "type": "integer", "required": true}],
                "responses": {
                    "200": {
                        "description": "成功",
                        "schema": {
                            "type": "object",
                            "properties": {
                                "hasConflict": {"type": "boolean"},
                                "conflicts": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "type": {"type": "string"},
                                            "message": {"type": "string"}
                                        }
                                    }
                                },
                                "suggestions": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "start": {"type": "string", "format": "date-time"},
                                            "end": {"type": "string", "format": "date-time"},
                                            "score": {"type": "number"}
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        "/api/exams/calendar": {
            "get": {
                "security": [{"Bearer": []}],
                "description": "获取日历视图数据",
                "produces": ["application/json"],
                "tags": ["考期管理"],
                "parameters": [
                    {"name": "start", "in": "query", "type": "string"},
                    {"name": "end", "in": "query", "type": "string"}
                ],
                "responses": {"200": {"description": "成功"}}
            }
        },
        "/api/questions": {
            "get": {
                "security": [{"Bearer": []}],
                "description": "获取题目列表",
                "produces": ["application/json"],
                "tags": ["题库管理"],
                "parameters": [
                    {"name": "page", "in": "query", "type": "integer", "default": 1},
                    {"name": "pageSize", "in": "query", "type": "integer", "default": 20},
                    {"name": "tradeId", "in": "query", "type": "integer"},
                    {"name": "level", "in": "query", "type": "integer"},
                    {"name": "type", "in": "query", "type": "string"},
                    {"name": "difficulty", "in": "query", "type": "integer"}
                ],
                "responses": {"200": {"description": "成功"}}
            },
            "post": {
                "security": [{"Bearer": []}],
                "description": "新增题目",
                "consumes": ["application/json"],
                "produces": ["application/json"],
                "tags": ["题库管理"],
                "responses": {"200": {"description": "成功"}}
            }
        },
        "/api/papers/generate": {
            "post": {
                "security": [{"Bearer": []}],
                "description": "智能组卷",
                "consumes": ["application/json"],
                "produces": ["application/json"],
                "tags": ["题库管理"],
                "parameters": [
                    {
                        "name": "body",
                        "in": "body",
                        "required": true,
                        "schema": {
                            "type": "object",
                            "properties": {
                                "tradeId": {"type": "integer"},
                                "level": {"type": "integer", "enum": [1,2,3]},
                                "questionNum": {"type": "integer", "minimum": 10},
                                "easyRatio": {"type": "number", "default": 0.3},
                                "mediumRatio": {"type": "number", "default": 0.5},
                                "hardRatio": {"type": "number", "default": 0.2},
                                "needABPaper": {"type": "boolean", "default": false}
                            }
                        }
                    }
                ],
                "responses": {"200": {"description": "成功"}}
            }
        },
        "/api/scores/batch": {
            "post": {
                "security": [{"Bearer": []}],
                "description": "批量导入成绩",
                "consumes": ["multipart/form-data"],
                "produces": ["application/json"],
                "tags": ["成绩管理"],
                "parameters": [
                    {"name": "file", "in": "formData", "type": "file", "required": true},
                    {"name": "examId", "in": "formData", "type": "integer", "required": true}
                ],
 "responses": {
                    "200": {
                        "description": "成功",
                        "schema": {
                            "type": "object",
                            "properties": {
                                "total": {"type": "integer"},
                                "success": {"type": "integer"},
                                "failed": {"type": "integer"},
                                "errorRows": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "rowNum": {"type": "integer"},
                                            "errors": {"type": "array", "items": {"type": "string"}},
                                            "rawData": {"type": "object"}
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        "/api/certificates/verify/{code}": {
            "get": {
                "description": "证书在线验真",
                "produces": ["application/json"],
                "tags": ["证书管理"],
                "parameters": [{"name": "code", "in": "path", "type": "string", "required": true}],
                "responses": {"200": {"description": "成功"}}
            }
        },
        "/api/statistics/overview": {
            "get": {
                "security": [{"Bearer": []}],
                "description": "首页统计概览",
                "produces": ["application/json"],
                "tags": ["统计分析"],
                "responses": {"200": {"description": "成功"}}
            }
        }
    },
    "securityDefinitions": {
        "Bearer": {
            "type": "apiKey",
            "name": "Authorization",
            "in": "header",
            "description": "JWT Authorization header using the Bearer scheme. Example: 'Bearer {token}'"
        }
    }
}`

type SwaggerInfo struct {
	Version     string
	Host        string
	BasePath    string
	Schemes     []string
	Title       string
	Description string
}

func (i *SwaggerInfo) ReadDoc() string {
	s := &SwaggerInfo{
		Version:     "1.0.0",
		Host:        "localhost:8080",
		BasePath:    "/",
		Schemes:     []string{"http", "https"},
		Title:       "职业技能鉴定管理系统 API",
		Description: "职业技能鉴定管理系统接口文档，涵盖考期管理、题库组卷、排期调度、成绩管理、证书管理等功能",
	}
	return s.Instantiate()
}

func (i *SwaggerInfo) Instantiate() string {
	return docTemplate
}

func init() {
	swag.Register("swagger", &SwaggerInfo{})
}
