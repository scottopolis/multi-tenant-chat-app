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
 * Allows users to switch between different agents.
 * Each agent belongs to an organization and has its own configuration.
 * The selected agent persists to localStorage.
 */

// Available agents - can be extended or fetched from API
const COMMON_AGENTS = [
  { id: 'new-agent', label: 'New Agent' },
  { id: 'default', label: 'Default Assistant' },
  { id: 'acme-support', label: 'Acme Customer Support' },
  { id: 'acme-sales', label: 'Acme Sales Assistant' },
  { id: 'contoso-general', label: 'Contoso Assistant' },
  { id: 'simplebot-shopping', label: 'Simple Bot Shopping' },
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

