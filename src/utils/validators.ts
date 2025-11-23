export function validateVestaboardText(text: string): { valid: boolean; error?: string } {
  // Vestaboard has 6 rows x 22 columns = 132 character limit
  const MAX_LENGTH = 132;

  if (!text || text.trim().length === 0) {
    return { valid: false, error: 'Text cannot be empty' };
  }

  if (text.length > MAX_LENGTH) {
    return { valid: false, error: `Text exceeds maximum length of ${MAX_LENGTH} characters` };
  }

  // TODO: Add validation for supported characters
  // Vestaboard has a limited character set

  return { valid: true };
}

export function validateApiKey(key: string): boolean {
  return typeof key === 'string' && key.length > 0;
}

export function validateUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function validateVote(vote: string): vote is 'good' | 'bad' {
  return vote === 'good' || vote === 'bad';
}
