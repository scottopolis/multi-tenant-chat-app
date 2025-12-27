import { useAgent } from '@/contexts/AgentContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * Agent Selector Component
 * 
 * Allows users to switch between different agents/tenants (orgId).
 * The selected agent persists to localStorage.
 */

// Common agent IDs - can be extended or fetched from API
const COMMON_AGENTS = [
  { id: 'default', label: 'Default' },
  { id: 'tenant-1', label: 'Tenant 1' },
  { id: 'tenant-2', label: 'Tenant 2' },
  { id: 'acme-support', label: 'ACME Support' },
];

export function AgentSelector() {
  const { agentId, setAgentId } = useAgent();

  return (
    <Select value={agentId} onValueChange={setAgentId}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Select agent" />
      </SelectTrigger>
      <SelectContent>
        {COMMON_AGENTS.map((agent) => (
          <SelectItem key={agent.id} value={agent.id}>
            {agent.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

