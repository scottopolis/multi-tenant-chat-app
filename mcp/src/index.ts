import { Hono } from 'hono';
import { serve } from '@hono/node-server';

/**
 * MCP Test Server
 * 
 * A local Model Context Protocol server for testing tool integration.
 * Implements JSON-RPC 2.0 protocol with MCP methods.
 * 
 * Endpoints:
 * - POST / - Handle MCP JSON-RPC requests (tools/list, tools/call)
 * 
 * Available tools:
 * - scottPhysicsFacts: Returns Scott's top 10 interesting physics facts
 */

const app = new Hono();

// Scott's top 10 interesting physics facts (static data)
const PHYSICS_FACTS = [
  {
    rank: 1,
    fact: "Quantum Entanglement: Einstein called it 'spooky action at a distance.' When two particles become entangled, measuring one instantly affects the other, regardless of the distance between them.",
    category: "Quantum Mechanics"
  },
  {
    rank: 2,
    fact: "Time Dilation: Time moves slower the faster you travel. At speeds close to light speed, you could travel for a year while decades pass on Earth.",
    category: "Relativity"
  },
  {
    rank: 3,
    fact: "Wave-Particle Duality: Light and matter behave as both particles and waves. A single photon can interfere with itself, passing through two slits simultaneously.",
    category: "Quantum Mechanics"
  },
  {
    rank: 4,
    fact: "Black Hole Information Paradox: Information that falls into a black hole appears to be lost forever, violating quantum mechanics. This paradox remains unsolved.",
    category: "Black Holes"
  },
  {
    rank: 5,
    fact: "Dark Energy: Makes up ~68% of the universe and causes the universe's expansion to accelerate. We still don't know what it is.",
    category: "Cosmology"
  },
  {
    rank: 6,
    fact: "Heisenberg Uncertainty Principle: You cannot simultaneously know both the exact position and momentum of a particle. The more precisely you measure one, the less you know about the other.",
    category: "Quantum Mechanics"
  },
  {
    rank: 7,
    fact: "Neutron Stars: A teaspoon of neutron star material would weigh about 1 billion tons on Earth. They're so dense that their gravity warps spacetime around them.",
    category: "Astrophysics"
  },
  {
    rank: 8,
    fact: "Quantum Tunneling: Particles can pass through energy barriers that classical physics says they shouldn't. This is how the Sun produces energy through nuclear fusion.",
    category: "Quantum Mechanics"
  },
  {
    rank: 9,
    fact: "Antimatter: Every particle has an antimatter twin. When matter and antimatter meet, they annihilate in a burst of pure energy.",
    category: "Particle Physics"
  },
  {
    rank: 10,
    fact: "Spacetime Curvature: Gravity isn't a force—it's the curvature of spacetime caused by mass and energy. Objects follow straight lines through curved spacetime.",
    category: "General Relativity"
  }
];

// MCP Tools definition
const TOOLS = [
  {
    name: 'scottPhysicsFacts',
    description: "Returns Scott's curated list of the top 10 most interesting physics facts, covering quantum mechanics, relativity, cosmology, and more.",
    inputSchema: {
      type: 'object',
      properties: {
        format: {
          type: 'string',
          description: 'Output format: "full" (default) or "summary"',
          enum: ['full', 'summary'],
          default: 'full'
        }
      }
    }
  }
];

/**
 * Handle MCP JSON-RPC requests
 */
app.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const { jsonrpc, id, method, params } = body;

    // Validate JSON-RPC 2.0 format
    if (jsonrpc !== '2.0') {
      return c.json({
        jsonrpc: '2.0',
        id,
        error: {
          code: -32600,
          message: 'Invalid Request: jsonrpc must be "2.0"'
        }
      }, 400);
    }

    // Handle tools/list - return available tools
    if (method === 'tools/list') {
      console.log('[MCP Server] tools/list requested');
      return c.json({
        jsonrpc: '2.0',
        id,
        result: {
          tools: TOOLS
        }
      });
    }

    // Handle tools/call - execute a tool
    if (method === 'tools/call') {
      const { name, arguments: args = {} } = params || {};
      
      console.log(`[MCP Server] tools/call: ${name}`, args);

      if (name === 'scottPhysicsFacts') {
        const format = args.format || 'full';
        
        let result;
        if (format === 'summary') {
          // Return just the facts without extra details
          result = PHYSICS_FACTS.map(item => `${item.rank}. ${item.fact}`).join('\n\n');
        } else {
          // Return full structured data
          result = JSON.stringify(PHYSICS_FACTS, null, 2);
        }

        return c.json({
          jsonrpc: '2.0',
          id,
          result: {
            result: result,
            isError: false
          }
        });
      }

      // Unknown tool
      return c.json({
        jsonrpc: '2.0',
        id,
        error: {
          code: -32601,
          message: `Method not found: ${name}`
        }
      }, 404);
    }

    // Unknown method
    return c.json({
      jsonrpc: '2.0',
      id,
      error: {
        code: -32601,
        message: `Method not found: ${method}`
      }
    }, 404);

  } catch (error) {
    console.error('[MCP Server] Error:', error);
    return c.json({
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32700,
        message: 'Parse error: ' + (error instanceof Error ? error.message : String(error))
      }
    }, 400);
  }
});

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    server: 'MCP Test Server',
    tools: TOOLS.map(t => t.name)
  });
});

// Root endpoint - server info
app.get('/', (c) => {
  return c.json({
    name: 'MCP Test Server',
    version: '1.0.0',
    protocol: 'Model Context Protocol (JSON-RPC 2.0)',
    endpoints: {
      'POST /': 'MCP JSON-RPC requests',
      'GET /health': 'Health check'
    },
    availableTools: TOOLS
  });
});

const PORT = 3030;

console.log(`🚀 MCP Test Server starting on http://localhost:${PORT}`);
console.log(`📋 Available tools: ${TOOLS.map(t => t.name).join(', ')}`);

serve({
  fetch: app.fetch,
  port: PORT
});

