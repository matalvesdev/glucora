import type { Coding, ObservationCatalog } from './observation';

/**
 * ADR-052's deliberately narrow initial catalog. Values are facts only:
 * there are no ranges, conversions, interpretations or recommendations.
 */
export const approvedManualGlucoseType: Coding = {
  system: 'http://loinc.org',
  code: '2339-0',
};

export const approvedManualGlucoseUnit: Coding = {
  system: 'http://unitsofmeasure.org',
  code: 'mg/dL',
};

export const approvedManualGlucoseCatalog: ObservationCatalog = {
  supports(type, unit) {
    return (
      type.system === approvedManualGlucoseType.system &&
      type.code === approvedManualGlucoseType.code &&
      unit.system === approvedManualGlucoseUnit.system &&
      unit.code === approvedManualGlucoseUnit.code
    );
  },
};
