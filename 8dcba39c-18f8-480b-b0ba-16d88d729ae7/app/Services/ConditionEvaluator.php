<?php

namespace App\Services;

class ConditionEvaluator
{
    protected $operators = [
        'equals' => 'equals',
        'not_equals' => 'notEquals',
        'contains' => 'contains',
        'not_contains' => 'notContains',
        'starts_with' => 'startsWith',
        'ends_with' => 'endsWith',
        'greater_than' => 'greaterThan',
        'less_than' => 'lessThan',
        'greater_equal' => 'greaterEqual',
        'less_equal' => 'lessEqual',
        'in' => 'inArray',
        'not_in' => 'notInArray',
        'between' => 'between',
        'is_null' => 'isNull',
        'is_not_null' => 'isNotNull',
        'is_empty' => 'isEmpty',
        'is_not_empty' => 'isNotEmpty',
        'regex' => 'regex',
        'date_before' => 'dateBefore',
        'date_after' => 'dateAfter',
    ];

    public function evaluate(array $condition, array $data): bool
    {
        $logicalOperator = $condition['operator'] ?? ($condition['logical'] ?? 'and');

        if (isset($condition['rules']) && is_array($condition['rules'])) {
            return $this->evaluateGroup($condition, $data);
        }

        if (isset($condition['conditions']) && is_array($condition['conditions'])) {
            return $this->evaluateGroup($condition, $data);
        }

        return $this->evaluateSingle($condition, $data);
    }

    protected function evaluateGroup(array $group, array $data): bool
    {
        $rules = $group['rules'] ?? $group['conditions'] ?? [];
        $logical = strtolower($group['operator'] ?? $group['logical'] ?? 'and');

        if (empty($rules)) {
            return true;
        }

        $results = [];
        foreach ($rules as $rule) {
            $results[] = $this->evaluate($rule, $data);
        }

        return $logical === 'or'
            ? in_array(true, $results, true)
            : !in_array(false, $results, true);
    }

    protected function evaluateSingle(array $rule, array $data): bool
    {
        $field = $rule['field'] ?? $rule['key'] ?? null;
        $operator = $rule['operator'] ?? 'equals';
        $value = $rule['value'] ?? null;

        if ($field === null) {
            return true;
        }

        $actualValue = $this->getFieldValue($data, $field);
        $method = $this->operators[$operator] ?? 'equals';

        if (!method_exists($this, $method)) {
            return false;
        }

        return $this->{$method}($actualValue, $value);
    }

    protected function getFieldValue(array $data, string $field): mixed
    {
        if (str_contains($field, '.')) {
            return data_get($data, $field);
        }
        return $data[$field] ?? null;
    }

    protected function equals($actual, $expected): bool
    {
        return (string) $actual === (string) $expected;
    }

    protected function notEquals($actual, $expected): bool
    {
        return (string) $actual !== (string) $expected;
    }

    protected function contains($haystack, $needle): bool
    {
        if (is_array($haystack)) {
            return in_array($needle, $haystack, true);
        }
        return stripos((string) $haystack, (string) $needle) !== false;
    }

    protected function notContains($haystack, $needle): bool
    {
        return !$this->contains($haystack, $needle);
    }

    protected function startsWith($haystack, $needle): bool
    {
        return str_starts_with(strtolower((string) $haystack), strtolower((string) $needle));
    }

    protected function endsWith($haystack, $needle): bool
    {
        return str_ends_with(strtolower((string) $haystack), strtolower((string) $needle));
    }

    protected function greaterThan($actual, $expected): bool
    {
        return (float) $actual > (float) $expected;
    }

    protected function lessThan($actual, $expected): bool
    {
        return (float) $actual < (float) $expected;
    }

    protected function greaterEqual($actual, $expected): bool
    {
        return (float) $actual >= (float) $expected;
    }

    protected function lessEqual($actual, $expected): bool
    {
        return (float) $actual <= (float) $expected;
    }

    protected function inArray($value, $array): bool
    {
        if (!is_array($array)) {
            $array = explode(',', (string) $array);
        }
        return in_array($value, array_map('strval', $array), true);
    }

    protected function notInArray($value, $array): bool
    {
        return !$this->inArray($value, $array);
    }

    protected function between($value, $range): bool
    {
        if (!is_array($range) || count($range) < 2) {
            return false;
        }
        [$min, $max] = $range;
        return (float) $value >= (float) $min && (float) $value <= (float) $max;
    }

    protected function isNull($value): bool
    {
        return $value === null;
    }

    protected function isNotNull($value): bool
    {
        return $value !== null;
    }

    protected function isEmpty($value): bool
    {
        return empty($value);
    }

    protected function isNotEmpty($value): bool
    {
        return !empty($value);
    }

    protected function regex($value, $pattern): bool
    {
        return (bool) @preg_match($pattern, (string) $value);
    }

    protected function dateBefore($date, $compare): bool
    {
        $dateTs = is_numeric($date) ? (int) $date : strtotime((string) $date);
        $compareTs = is_numeric($compare) ? (int) $compare : strtotime((string) $compare);
        return $dateTs !== false && $compareTs !== false && $dateTs < $compareTs;
    }

    protected function dateAfter($date, $compare): bool
    {
        $dateTs = is_numeric($date) ? (int) $date : strtotime((string) $date);
        $compareTs = is_numeric($compare) ? (int) $compare : strtotime((string) $compare);
        return $dateTs !== false && $compareTs !== false && $dateTs > $compareTs;
    }
}
