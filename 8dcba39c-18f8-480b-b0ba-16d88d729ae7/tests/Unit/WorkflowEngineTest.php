<?php

namespace Tests\Unit;

use App\Services\WorkflowEngine;
use Tests\TestCase;

class WorkflowEngineTest extends TestCase
{
    protected WorkflowEngine $workflowEngine;

    protected function setUp(): void
    {
        parent::setUp();
        $this->workflowEngine = app('workflow.engine');
    }

    public function test_workflow_engine_is_bound(): void
    {
        $this->assertInstanceOf(WorkflowEngine::class, $this->workflowEngine);
    }

    public function test_default_states_exist(): void
    {
        $states = WorkflowEngine::DEFAULT_STATES;
        $this->assertIsArray($states);
        $this->assertNotEmpty($states);
        $this->assertContains('open', array_column($states, 'key'));
        $this->assertContains('closed', array_column($states, 'key'));
        $this->assertContains('resolved', array_column($states, 'key'));
    }

    public function test_default_transitions_are_valid(): void
    {
        $transitions = WorkflowEngine::DEFAULT_TRANSITIONS;
        $this->assertIsArray($transitions);
        $this->assertNotEmpty($transitions);

        foreach ($transitions as $transition) {
            $this->assertArrayHasKey('from_state', $transition);
            $this->assertArrayHasKey('to_state', $transition);
            $this->assertNotEmpty($transition['from_state']);
            $this->assertNotEmpty($transition['to_state']);
        }
    }
}
