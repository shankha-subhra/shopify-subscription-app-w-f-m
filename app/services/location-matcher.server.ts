type Destination = {
  countryCode?: string | null;
  stateCode?: string | null;
  city?: string | null;
  postalCode?: string | null;
};

type Rule = {
  id: number;
  countryCode?: string | null;
  stateCode?: string | null;
  city?: string | null;
  postalCode?: string | null;
  postalCodeFrom?: string | null;
  postalCodeTo?: string | null;
  postalCodePattern?: string | null;
  priority: number;
  updatedAt: Date;
  [key: string]: any; // Allow other fields
};

function normalize(value?: string | null) {
  return value?.trim().toUpperCase() || null;
}

function normalizeCity(value?: string | null) {
  return value?.trim().toLowerCase() || null;
}

function matchPostalCode(rule: Rule, destZip: string | null): boolean | null {
  if (!destZip) return false;
  const normalizedDestZip = normalize(destZip)!.replace(/\s+/g, "");

  // 1. Exact match
  if (rule.postalCode) {
    const ruleZip = normalize(rule.postalCode)!.replace(/\s+/g, "");
    if (ruleZip === normalizedDestZip) return true;
  }

  // 2. Range match
  if (rule.postalCodeFrom && rule.postalCodeTo) {
    const from = normalize(rule.postalCodeFrom)!.replace(/\s+/g, "");
    const to = normalize(rule.postalCodeTo)!.replace(/\s+/g, "");
    if (normalizedDestZip >= from && normalizedDestZip <= to) return true;
  }

  // 3. Pattern match
  if (rule.postalCodePattern) {
    const pattern = normalize(rule.postalCodePattern)!.replace(/\s+/g, "");
    const regexStr = "^" + pattern.replace(/\*/g, ".*") + "$";
    try {
      const regex = new RegExp(regexStr);
      if (regex.test(normalizedDestZip)) return true;
    } catch (e) {
      // Invalid pattern, ignore
    }
  }

  return rule.postalCode || rule.postalCodeFrom || rule.postalCodeTo || rule.postalCodePattern ? false : null; // null means no rule specified
}

export function findMostSpecificLocationRule(rules: Rule[], destination: Destination): Rule | null {
  const destCountry = normalize(destination.countryCode);
  const destState = normalize(destination.stateCode);
  const destCity = normalizeCity(destination.city);
  const destZip = destination.postalCode;

  let bestMatch: Rule | null = null;
  let highestScore = -1;

  for (const rule of rules) {
    let score = 0;
    let isMatch = true;

    // Check Country
    if (rule.countryCode) {
      if (normalize(rule.countryCode) !== destCountry) {
        isMatch = false;
        continue;
      }
      score += 100;
    }

    // Check State
    if (rule.stateCode) {
      if (normalize(rule.stateCode) !== destState) {
        isMatch = false;
        continue;
      }
      score += 100; // 200 total if country matches
    }

    // Check City
    if (rule.city) {
      if (normalizeCity(rule.city) !== destCity) {
        isMatch = false;
        continue;
      }
      score += 100; // 300 total if country and state match
    }

    // Check Postal Code
    const zipMatch = matchPostalCode(rule, destZip);
    if (zipMatch === false) {
      isMatch = false;
      continue;
    } else if (zipMatch === true) {
      if (rule.postalCodePattern) score += 100; // 400 total
      else if (rule.postalCodeFrom && rule.postalCodeTo) score += 150; // 450 total
      else if (rule.postalCode) score += 200; // 500 total
    }

    if (isMatch && score > 0) { // Require at least one field to match
      if (score > highestScore) {
        highestScore = score;
        bestMatch = rule;
      } else if (score === highestScore) {
        if (bestMatch && rule.priority > bestMatch.priority) {
          bestMatch = rule;
        } else if (bestMatch && rule.priority === bestMatch.priority) {
          if (rule.updatedAt > bestMatch.updatedAt) {
            bestMatch = rule;
          }
        }
      }
    }
  }

  return bestMatch;
}
