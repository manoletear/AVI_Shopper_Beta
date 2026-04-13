import Anthropic from '@anthropic-ai/sdk';
import { AVI_TEAM, getAgent, type AgentDefinition } from './team';

// ============================================
// AGENT RUNNER
// Ejecuta agentes del equipo AVI via Claude API
//
// Uso:
//   ANTHROPIC_API_KEY=sk-... npx ts-node agents/runner.ts
// ============================================

const client = new Anthropic();

interface TaskResult {
  agentId: string;
  agentName: string;
  task: string;
  response: string;
  tokensUsed: { input: number; output: number };
  duration: number;
}

interface ExecutionPlan {
  steps: Array<{
    agentId: string;
    task: string;
    dependsOn?: string[];  // IDs de steps anteriores
  }>;
}

// ============================================
// EJECUTAR UN AGENTE
// ============================================

async function runAgent(
  agent: AgentDefinition,
  task: string,
  context: string = ''
): Promise<TaskResult> {
  const start = Date.now();

  const userMessage = context
    ? `CONTEXTO PREVIO:\n${context}\n\nTAREA:\n${task}`
    : task;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: agent.systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n');

  return {
    agentId: agent.id,
    agentName: agent.name,
    task,
    response: text,
    tokensUsed: {
      input: response.usage.input_tokens,
      output: response.usage.output_tokens,
    },
    duration: Date.now() - start,
  };
}

// ============================================
// ORQUESTADOR — Descompone y asigna tareas
// ============================================

async function orchestrate(requirement: string): Promise<ExecutionPlan> {
  const orchestrator = getAgent('orchestrator')!;

  const teamDescription = AVI_TEAM
    .filter((a) => a.id !== 'orchestrator')
    .map((a) => `- ${a.id}: ${a.name} — ${a.role}`)
    .join('\n');

  const planPrompt = `Tengo este requerimiento para AVI Shopper:

"${requirement}"

Mi equipo disponible:
${teamDescription}

Descompone el requerimiento en tareas concretas. Para cada tarea indica:
1. agentId: quien la ejecuta
2. task: descripcion precisa de lo que debe hacer
3. dependsOn: IDs de tareas que deben completarse antes (si aplica)

Responde SOLO en JSON valido con este formato:
{
  "steps": [
    { "agentId": "architect", "task": "...", "dependsOn": [] },
    { "agentId": "backend", "task": "...", "dependsOn": ["0"] }
  ]
}

REGLAS:
- Maximo 6 steps
- Ser concreto: "Crear API route GET /api/X que retorne Y" no "hacer el backend"
- Si algo se puede hacer en paralelo, no poner dependencia`;

  const result = await runAgent(orchestrator, planPrompt);

  // Extraer JSON del response
  const jsonMatch = result.response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Orchestrator no retorno un plan valido');
  }

  return JSON.parse(jsonMatch[0]) as ExecutionPlan;
}

// ============================================
// EJECUTAR PLAN COMPLETO
// ============================================

async function executePlan(plan: ExecutionPlan): Promise<TaskResult[]> {
  const results: TaskResult[] = [];
  const completed: Map<string, string> = new Map(); // stepIndex → response

  for (let i = 0; i < plan.steps.length; i++) {
    const step = plan.steps[i];
    const agent = getAgent(step.agentId);

    if (!agent) {
      console.error(`Agente no encontrado: ${step.agentId}`);
      continue;
    }

    // Construir contexto de dependencias
    let context = '';
    if (step.dependsOn && step.dependsOn.length > 0) {
      context = step.dependsOn
        .map((depIdx) => {
          const depResult = completed.get(depIdx);
          const depStep = plan.steps[parseInt(depIdx)];
          return depResult
            ? `[${depStep?.agentId}] completó: ${depResult.substring(0, 500)}`
            : '';
        })
        .filter(Boolean)
        .join('\n\n');
    }

    console.log(`\n[${ i + 1}/${plan.steps.length}] ${agent.name} → ${step.task.substring(0, 80)}...`);

    const result = await runAgent(agent, step.task, context);
    results.push(result);
    completed.set(String(i), result.response);

    console.log(`   ✓ ${result.tokensUsed.input + result.tokensUsed.output} tokens, ${result.duration}ms`);
  }

  return results;
}

// ============================================
// PIPELINE DE PRODUCCION
// ============================================

export async function runProductionPipeline(): Promise<TaskResult[]> {
  const plan: ExecutionPlan = {
    steps: [
      {
        agentId: 'architect',
        task: 'Revisa la arquitectura actual de AVI Shopper. Lee los archivos clave (prisma/schema.prisma, package.json, src/app/api/, src/services/). Identifica: 1) Que falta para produccion, 2) Riesgos de seguridad, 3) Cambios necesarios para PostgreSQL. Lista priorizada.',
      },
      {
        agentId: 'qa',
        task: 'Escribe tests E2E con Playwright para los 3 flujos criticos: 1) Registro de usuario, 2) Crear lista y agregar producto, 3) API de health report. Usa el patron de Playwright con test.describe y expect.',
        dependsOn: ['0'],
      },
      {
        agentId: 'devops',
        task: 'Crea el archivo .github/workflows/ci.yml con: 1) Lint + typecheck en push/PR, 2) Tests con Playwright, 3) Build de verificacion. Crea tambien un script de migracion SQLite→PostgreSQL en scripts/migrate-to-postgres.ts.',
        dependsOn: ['0'],
      },
      {
        agentId: 'frontend',
        task: 'Revisa todas las paginas (page.tsx, demo/page.tsx, configuracion/cuentas/page.tsx). Identifica: 1) Links rotos o navegacion faltante, 2) Formularios sin validacion client-side, 3) Problemas de accesibilidad. Propone fixes concretos.',
        dependsOn: ['0'],
      },
      {
        agentId: 'ux_designer',
        task: 'Define el flujo critico de onboarding: nuevo usuario → registro → vincular primer supermercado → crear primera lista → ver ahorro. Escribe el copy de cada pantalla en español chileno y define las acciones principales por pantalla.',
        dependsOn: ['3'],
      },
      {
        agentId: 'devops',
        task: 'Genera el checklist final de deploy: variables de entorno, configuracion de Vercel, DNS, PostgreSQL, NEXTAUTH_SECRET, y el comando exacto para cada paso.',
        dependsOn: ['1', '2'],
      },
    ],
  };

  return executePlan(plan);
}

// ============================================
// MAIN — Punto de entrada
// ============================================

async function main() {
  const args = process.argv.slice(2);

  if (args[0] === '--pipeline') {
    // Ejecutar pipeline de produccion predefinido
    console.log('🚀 Ejecutando pipeline de produccion AVI Shopper...');
    const results = await runProductionPipeline();
    printSummary(results);
    return;
  }

  if (args[0] === '--agent' && args[1] && args[2]) {
    // Ejecutar un agente especifico con tarea
    const agent = getAgent(args[1]);
    if (!agent) {
      console.error(`Agente no encontrado: ${args[1]}`);
      console.log('Agentes disponibles:', AVI_TEAM.map((a) => a.id).join(', '));
      process.exit(1);
    }

    const task = args.slice(2).join(' ');
    console.log(`\n🤖 ${agent.name} → ${task}\n`);
    const result = await runAgent(agent, task);
    console.log(result.response);
    console.log(`\n📊 ${result.tokensUsed.input + result.tokensUsed.output} tokens, ${result.duration}ms`);
    return;
  }

  if (args[0] && !args[0].startsWith('--')) {
    // Orquestar un requerimiento libre
    const requirement = args.join(' ');
    console.log(`\n📋 Orquestando: "${requirement}"\n`);

    const plan = await orchestrate(requirement);
    console.log(`Plan: ${plan.steps.length} tareas`);
    plan.steps.forEach((s, i) =>
      console.log(`  ${i + 1}. [${s.agentId}] ${s.task.substring(0, 70)}...`)
    );

    console.log('\nEjecutando...');
    const results = await executePlan(plan);
    printSummary(results);
    return;
  }

  // Help
  console.log(`
AVI Shopper — Equipo Agéntico

Uso:
  npx ts-node agents/runner.ts --pipeline
    Ejecuta el pipeline completo de produccion

  npx ts-node agents/runner.ts --agent <id> <tarea>
    Ejecuta un agente especifico con una tarea
    Agentes: ${AVI_TEAM.map((a) => a.id).join(', ')}

  npx ts-node agents/runner.ts <requerimiento libre>
    El orchestrator descompone y asigna automaticamente

Ejemplos:
  npx ts-node agents/runner.ts --agent backend "Crear API para favoritos del usuario"
  npx ts-node agents/runner.ts "Agregar sistema de notificaciones push"
  npx ts-node agents/runner.ts --pipeline
`);
}

function printSummary(results: TaskResult[]) {
  console.log('\n========================================');
  console.log('RESUMEN DE EJECUCION');
  console.log('========================================');

  let totalTokens = 0;
  let totalTime = 0;

  for (const r of results) {
    const tokens = r.tokensUsed.input + r.tokensUsed.output;
    totalTokens += tokens;
    totalTime += r.duration;
    console.log(`\n${r.agentName}:`);
    console.log(`  Tarea: ${r.task.substring(0, 80)}...`);
    console.log(`  Tokens: ${tokens} (in: ${r.tokensUsed.input}, out: ${r.tokensUsed.output})`);
    console.log(`  Tiempo: ${r.duration}ms`);
  }

  console.log('\n----------------------------------------');
  console.log(`Total tokens: ${totalTokens}`);
  console.log(`Total tiempo: ${(totalTime / 1000).toFixed(1)}s`);
  console.log(`Costo estimado: ~$${((totalTokens / 1000000) * 3).toFixed(4)} USD`);
}

main().catch(console.error);
