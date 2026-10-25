import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { allowsProposedItem, allowsSubstitution, proposalWarning } from '@/services/household/constraints';
import { evaluateAllergens } from '@/lib/nutrition/check-allergens';
import { SUBSTITUTION_MODES, parseStepState } from '@/lib/onboarding/model';
import {
  BASIC_STEP_IDS,
  DEFAULT_SUBSTITUTION_MODE,
  PROGRESSIVE_IDS,
  addressStepSchema,
  allergiesStepSchema,
  allergyWarnings,
  buildBasicCompletion,
  completeProgressive,
  emptyHousehold,
  householdStepSchema,
  parseBasicState,
  profileCompleteness,
  storesStepSchema,
  sustitucionSchema,
  withNana,
  withPeople,
} from './basic';

const home = {
  street: 'Los Leones',
  number: '123',
  comuna: 'Providencia',
  housingType: 'casa' as const,
  accessNote: 'Timbre blanco',
};

describe('onboarding básico', () => {
  it('son 5 pasos y la sustitución recomendada es proponer y aprobar', () => {
    assert.deepEqual(BASIC_STEP_IDS, ['address', 'household', 'allergies', 'stores', 'approver']);
    assert.equal(DEFAULT_SUBSTITUTION_MODE, 'propose_approve');
    const recommended = SUBSTITUTION_MODES[0];
    assert.ok(recommended);
    assert.equal(recommended.id, 'propose_approve');
    assert.equal(recommended.label, 'Proponer reemplazo y que yo apruebe');
    const mode = sustitucionSchema.safeParse({ mode: 'propose_approve' });
    assert.equal(mode.success, true);
  });

  it('valida dirección, tipo de vivienda y tiendas', () => {
    assert.equal(addressStepSchema.safeParse({ ...home, street: 'Lo' }).success, false);
    assert.equal(addressStepSchema.safeParse({ ...home, housingType: 'oficina' }).success, false);
    const address = addressStepSchema.safeParse(home);
    assert.equal(address.success, true);
    if (!address.success) return;
    assert.equal(address.data.housingType, 'casa');
    assert.equal(storesStepSchema.safeParse({ chains: [] }).success, false);
    const stores = storesStepSchema.safeParse({ chains: ['jumbo', 'lider', 'unimarc', 'tottus'] });
    assert.equal(stores.success, true);
  });

  it('la nana cuenta en las personas y puede ser puertas adentro', () => {
    const base = emptyHousehold('Manuel');
    const withFour = withPeople(base, 4, 'Manuel');
    const nana = withNana(withFour, 'adentro', 'Manuel');
    assert.equal(nana.people, 4);
    assert.equal(nana.adults + nana.children + 1, 4);
    const nanaMember = nana.members.filter((member) => member.kind === 'nana')[0];
    assert.ok(nanaMember);
    assert.equal(nanaMember.nanaMode, 'adentro');
    const parsed = householdStepSchema.safeParse({
      ...nana,
      members: nana.members.map((member, index) => ({ ...member, name: member.name || `Persona ${index + 1}` })),
    });
    assert.equal(parsed.success, true);
    const broken = householdStepSchema.safeParse({
      ...nana,
      people: 3,
      members: nana.members.map((member, index) => ({ ...member, name: member.name || `Persona ${index + 1}` })),
    });
    assert.equal(broken.success, false);
    if (broken.success) return;
    const issue = broken.error.issues[0];
    assert.ok(issue);
    assert.match(issue.message, /nana cuenta/);
  });

  it('las alergias son por persona y producen aviso, no bloqueo', () => {
    const none = allergiesStepSchema.safeParse({
      allergens: ['ninguna', 'gluten'],
      assignments: [],
    });
    assert.equal(none.success, false);
    const missingWho = allergiesStepSchema.safeParse({
      allergens: ['huevo'],
      assignments: [],
    });
    assert.equal(missingWho.success, false);
    const ok = allergiesStepSchema.safeParse({
      allergens: ['mani_frutos_secos', 'lacteos'],
      assignments: [
        { allergen: 'mani_frutos_secos', memberName: 'Ana' },
        { allergen: 'lacteos', memberName: 'Lucho' },
      ],
    });
    assert.equal(ok.success, true);
    if (!ok.success) return;
    const warnings = allergyWarnings(ok.data.assignments);
    assert.equal(warnings.length, 2);
    const firstWarning = warnings[0];
    assert.ok(firstWarning);
    assert.match(firstWarning, /Ana/);
    assert.match(firstWarning, /no bloquea/);
    const decision = evaluateAllergens(['peanut', 'milk'], [], 'verified', [
      { id: 'ana', name: 'Ana', allergens: ['mani', 'frutos_secos'] },
      { id: 'lucho', name: 'Lucho', allergens: ['lacteos'] },
    ]);
    assert.equal(decision.requiresApproval, true);
    assert.ok(decision.warnings.some((warning) => warning.members.some((member) => member.name === 'Ana')));
    assert.equal(Object.prototype.hasOwnProperty.call(decision, 'blocked'), false);
    assert.equal(allowsProposedItem('Mantequilla de maní', { allergens: ['mani'], allergenPolicy: 'warn' }), false);
    const warning = proposalWarning('Mantequilla de maní', { allergens: ['mani'], allergenPolicy: 'warn' });
    assert.ok(warning);
    assert.match(warning || '', /no bloquea/);
    assert.equal(allowsSubstitution('Mermelada', {
      allergens: [],
      substitutionMode: 'propose_approve',
      allergenPolicy: 'warn',
    }), true);
  });

  it('al cerrar el básico guarda basic_done, propose_approve y lo progresivo pendiente', () => {
    const household = withPeople(emptyHousehold('Manuel'), 2, 'Manuel');
    const second = household.members[1];
    assert.ok(second);
    second.name = 'Ana';
    const answers = {
      address: home,
      household,
      allergies: { allergens: ['ninguna' as const], assignments: [] },
      stores: { chains: ['jumbo' as const, 'lider' as const, 'unimarc' as const, 'tottus' as const] },
      approver: { memberName: 'Manuel' },
    };
    const done = buildBasicCompletion(answers);
    assert.equal(done.onboardingStep, 'basic_done');
    assert.equal(done.substitutionMode, 'propose_approve');
    assert.deepEqual(done.state.pendingProgressive, [...PROGRESSIVE_IDS]);
    assert.equal(done.state.allergyPolicy, 'warn');
    const again = parseBasicState(done.stepState);
    assert.equal(again.explicitPending, true);
    assert.equal(again.answers.address?.housingType, 'casa');
    assert.equal(parseStepState(done.stepState).address, 'done');
    assert.equal(profileCompleteness(again.pendingProgressive), 0);
    const afterBudget = completeProgressive(again, 'presupuesto', { monthlyBudget: 300000 });
    assert.equal(afterBudget.pendingProgressive.includes('presupuesto'), false);
    assert.equal(profileCompleteness(afterBudget.pendingProgressive), Math.round((1 / 9) * 100));
  });
});
