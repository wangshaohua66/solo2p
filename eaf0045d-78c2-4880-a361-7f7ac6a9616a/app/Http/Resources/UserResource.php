<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'username' => $this->username,
            'name' => $this->name,
            'email' => $this->email,
            'phone' => $this->phone,
            'company_name' => $this->company_name,
            'role' => $this->role,
            'role_name' => $this->getRoleName(),
            'credit_score' => $this->credit_score,
            'is_active' => $this->is_active,
            'created_at' => $this->created_at->toDateTimeString(),
        ];
    }

    protected function getRoleName(): string
    {
        return match ($this->role) {
            'generator' => '发电商',
            'purchaser' => '购电方',
            'exchange' => '交易中心',
            'regulator' => '监管机构',
            default => '未知',
        };
    }
}
