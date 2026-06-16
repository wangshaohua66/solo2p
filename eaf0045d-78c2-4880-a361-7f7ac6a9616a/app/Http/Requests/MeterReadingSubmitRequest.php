<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class MeterReadingSubmitRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'readings' => 'required|array|max:200',
            'readings.*.station_code' => 'required|string|max:50',
            'readings.*.report_month' => 'required|string|size:7',
            'readings.*.generation_kwh' => 'required|numeric|min:0',
        ];
    }

    public function messages(): array
    {
        return [
            'readings.required' => '请提供上报数据',
            'readings.array' => '上报数据格式错误',
            'readings.max' => '单次最多上报200条记录',
            'readings.*.station_code.required' => '电站编号不能为空',
            'readings.*.report_month.required' => '上报月份不能为空',
            'readings.*.report_month.size' => '月份格式应为YYYY-MM',
            'readings.*.generation_kwh.required' => '发电量不能为空',
            'readings.*.generation_kwh.numeric' => '发电量必须为数字',
            'readings.*.generation_kwh.min' => '发电量不能为负数',
        ];
    }
}
