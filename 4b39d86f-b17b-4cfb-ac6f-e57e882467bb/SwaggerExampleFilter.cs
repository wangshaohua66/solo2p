using Microsoft.OpenApi.Any;
using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;
using System.Reflection;

namespace HazChemSupervision;

public class SwaggerExampleFilter : ISchemaFilter
{
    public void Apply(OpenApiSchema schema, SchemaFilterContext context)
    {
        if (schema.Properties == null)
            return;

        foreach (var property in schema.Properties)
        {
            if (property.Value.Example != null)
                continue;

            var propName = property.Key.ToLower();
            property.Value.Example = propName switch
            {
                "name" or "realname" or "holdername" or "drivername" or "escortname" or "operatorname" or "inspectorname" => new OpenApiString("张三"),
                "username" => new OpenApiString("admin"),
                "password" => new OpenApiString("Admin@123"),
                "phone" or "driverphone" => new OpenApiString("13800138000"),
                "email" => new OpenApiString("example@gov.cn"),
                "idcard" or "holderidcard" => new OpenApiString("110101199001011234"),
                "address" or "location" or "startaddress" or "endaddress" => new OpenApiString("北京市朝阳区示例路123号"),
                "batchno" => new OpenApiString("BATCH-20240115-001"),
                "certificateno" => new OpenApiString("WH-HZ-2024-001234"),
                "alertno" => new OpenApiString("ALERT-20240115-0001"),
                "transportno" or "vehicleno" => new OpenApiString("TRANS-2024-0001"),
                "vehicleplateno" => new OpenApiString("京A12345"),
                "driverlicenseno" => new OpenApiString("110000199001011234"),
                "workorderno" => new OpenApiString("HZ-2024-0001"),
                "planno" => new OpenApiString("DRILL-2024-Q1-001"),
                "code" => new OpenApiString("CHEM-001"),
                "unit" => new OpenApiString("kg"),
                "remark" or "content" or "description" => new OpenApiString("示例备注信息"),
                "title" => new OpenApiString("示例标题"),
                "suggestion" => new OpenApiString("示例处置建议"),
                "department" => new OpenApiString("生产部"),
                "position" => new OpenApiString("主管"),
                "quantity" or "plannedquantity" or "maxcapacity" or "minsafequantity" or "reorderlevel" or "currentusedcapacity" or "balancebefore" or "balanceafter" or "totalquantity" => new OpenApiDouble(1000.0),
                "reservedquantity" => new OpenApiDouble(50.0),
                "pageindex" or "page" or "pagenumber" => new OpenApiInteger(1),
                "pagesize" or "limit" => new OpenApiInteger(20),
                "type" or "category" or "status" or "level" => new OpenApiInteger(1),
                "id" or "enterpriseid" or "warehouseid" or "chemicalid" or "batchid" or "transportrecordid" or "hazardrectificationid" or "emergencydrillid" or "certificateid" or "operatorid" or "userid" or "recipientuserid" or "handleruserid" or "warehouseid" or "chemicalbatchid" or "inventoryid" or "transactiontype" => new OpenApiInteger(1),
                "year" => new OpenApiInteger(2024),
                "month" => new OpenApiInteger(1),
                "quarter" => new OpenApiInteger(1),
                "days" => new OpenApiInteger(30),
                "speed" or "currentspeed" or "speedlimitkmh" => new OpenApiDouble(60.0),
                "temperature" or "currenttemperature" or "temperaturemaxc" or "temperatureminc" => new OpenApiDouble(25.0),
                "longitude" or "startlongitude" or "endlongitude" => new OpenApiDouble(116.397428),
                "latitude" or "startlatitude" or "endlatitude" => new OpenApiDouble(39.90923),
                "routedeviationmeters" => new OpenApiInteger(500),
                "usagerate" or "overstockthreshold" or "lowstockthreshold" or "score" => new OpenApiDouble(85.5),
                "isactive" or "isread" or "ishandled" or "hasalerts" or "hasanomaly" => new OpenApiBoolean(true),
                _ => GetDefaultExampleByType(property.Value.Type, property.Value.Format)
            };
        }
    }

    private static IOpenApiAny GetDefaultExampleByType(string? type, string? format)
    {
        return type switch
        {
            "string" when format == "date-time" => new OpenApiString("2024-01-15T08:00:00Z"),
            "string" when format == "date" => new OpenApiString("2024-01-15"),
            "string" => new OpenApiString("示例值"),
            "integer" or "number" when format == "int32" => new OpenApiInteger(0),
            "integer" or "number" when format == "int64" => new OpenApiLong(0),
            "number" when format == "decimal" or format == "double" or format == "float" => new OpenApiDouble(0.0),
            "boolean" => new OpenApiBoolean(false),
            "array" => new OpenApiArray(),
            "object" => new OpenApiObject(),
            _ => new OpenApiNull()
        };
    }
}
