import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { householdEquivalents, plannedEquivalents } from '@/services/consumption/predict';
import {
  HOUSEHOLD_DEFAULTS,
  emptyStepState,
  mandatoryComplete,
  parseAddress,
  parseBudget,
  parseStores,
  resumeStep,
  transition,
  wizardFinished,
} from './model';

describe('onboarding del hogar', () => {
  it('solo dirección y tiendas son obligatorias, y se retoma el paso pendiente', () => {
    let steps = emptyStepState();
    const skipped = transition(steps, 'address', 'skip');
    assert.equal(skipped.ok, false);
    const saved = transition(steps, 'address', 'save');
    assert.equal(saved.ok, true);
    if (!saved.ok) return;
    steps = saved.steps;
    assert.equal(saved.next, 'stores');
    assert.equal(mandatoryComplete(steps), false);
    const stores = transition(steps, 'stores', 'save');
    assert.equal(stores.ok, true);
    if (!stores.ok) return;
    steps = stores.steps;
    assert.equal(mandatoryComplete(steps), true);
    const household = transition(steps, 'household', 'skip');
    assert.equal(household.ok, true);
    if (!household.ok) return;
    steps = household.steps;
    assert.equal(resumeStep(steps), 'members');
    for (const id of ['members', 'allergies', 'diets', 'pets', 'substitutions', 'cadence', 'budget'] as const) {
      const moved = transition(steps, id, 'skip');
      assert.equal(moved.ok, true);
      if (!moved.ok) return;
      steps = moved.steps;
    }
    assert.equal(wizardFinished(steps), true);
    assert.equal(resumeStep(steps), 'done');
  });

  it('usa los valores por defecto de Manuel y la ventana del sábado', () => {
    assert.equal(HOUSEHOLD_DEFAULTS.approverRole, 'master');
    assert.equal(HOUSEHOLD_DEFAULTS.elderWeight, 0.8);
    assert.equal(HOUSEHOLD_DEFAULTS.proposeAlcohol, true);
    assert.equal(HOUSEHOLD_DEFAULTS.substitutionMode, 'propose_approve');
    const address = parseAddress({
      street: 'Los Leones',
      number: '123',
      comuna: 'Providencia',
      dropoff: 'door',
      windows: [],
    });
    assert.equal(address.ok, true);
    if (!address.ok) return;
    assert.deepEqual(address.value.windows, [{ day: 'sabado', start: '09:00', end: '13:00' }]);
    const stores = parseStores({
      mode: 'delivery',
      stores: [
        { chain: 'jumbo', enabled: true, loyaltyProgram: 'jumbo_prime' },
        { chain: 'unimarc', enabled: true, loyaltyProgram: 'club_unimarc' },
      ],
    });
    assert.equal(stores.ok, true);
    if (!stores.ok) return;
    assert.equal(stores.value.stores.find((store) => store.chain === 'unimarc')?.loyaltyProgram, 'club_unimarc');
    const budget = parseBudget({ proposeAlcohol: undefined });
    assert.equal(budget.ok, true);
    if (!budget.ok) return;
    assert.equal(budget.value.proposeAlcohol, true);
    assert.equal(budget.value.monthlyBudget, null);
    assert.equal(budget.value.orderCap, null);
  });

  it('el adulto mayor pesa 0,8 y el tamaño del hogar reemplaza el conteo cuando está', () => {
    const equivalents = householdEquivalents([
      { role: 'adult', type: 'person' },
      { role: 'child', type: 'person' },
      { role: 'elder', type: 'person' },
      { role: 'adult', type: 'pet' },
    ]);
    assert.ok(Math.abs(equivalents - 2.4) < 1e-9);
    const planned = plannedEquivalents(
      [{ role: 'elder', type: 'person' }],
      4,
      0.8,
    );
    assert.ok(Math.abs(planned - 3.8) < 1e-9);
  });
});
