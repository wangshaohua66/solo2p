<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class BulkImportRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'file' => ['required', 'file', 'mimes:csv,json,txt', 'max:10240'],
            'format' => ['required', 'string', 'in:csv,json,mtgo,mws'],
            'type' => ['required', 'string', 'in:collection,deck,matches'],
        ];
    }
}
