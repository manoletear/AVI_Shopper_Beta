import { heuristicFuzzyMatcher } from './ai';
import { LABELED_CASES, LABELED_PRODUCTS, LabeledCase } from './examples';
import { matchListing } from './match';

export interface AccuracyReport {
  total: number;
  correct: number;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  trueNegatives: number;
  precision: number;
  recall: number;
  accuracy: number;
}

export async function measureMatchAccuracy(cases: LabeledCase[] = LABELED_CASES): Promise<AccuracyReport> {
  let truePositives = 0;
  let falsePositives = 0;
  let falseNegatives = 0;
  let trueNegatives = 0;

  for (const item of cases) {
    const decision = await matchListing(
      { rawName: item.rawName, ean: item.ean },
      LABELED_PRODUCTS,
      heuristicFuzzyMatcher,
    );
    const predicted = decision.status === 'matched' ? decision.canonicalId : null;
    if (item.expect == null) {
      if (predicted) falsePositives += 1;
      else trueNegatives += 1;
      continue;
    }
    if (predicted === item.expect) truePositives += 1;
    else if (predicted) falsePositives += 1;
    else falseNegatives += 1;
  }

  const total = cases.length;
  const correct = truePositives + trueNegatives;
  const predictedPositives = truePositives + falsePositives;
  const actualPositives = truePositives + falseNegatives;
  return {
    total,
    correct,
    truePositives,
    falsePositives,
    falseNegatives,
    trueNegatives,
    precision: predictedPositives ? truePositives / predictedPositives : 1,
    recall: actualPositives ? truePositives / actualPositives : 1,
    accuracy: total ? correct / total : 1,
  };
}
