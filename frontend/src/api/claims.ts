export interface AssessmentResult {
  claim: {
    id: string;
    title: string;
    claimText: string;
    status: string;
    createdAt: string;
  };
  assessment: {
    id: string;
    justified: boolean;
    confidenceScore: number;
    reasoning: string;
    modelUsed: string | null;
    createdAt: string;
  };
}

export interface AssessClaimPayload {
  title: string;
  claimText: string;
  evidence: string;
  productFormula?: string;
  scientistName?: string;
  claimType?: string;
}

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export async function assessClaim(
  payload: AssessClaimPayload,
): Promise<AssessmentResult> {
  const response = await fetch(`${API_BASE}/api/claims/assess`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(errorBody || `Assessment failed (${response.status})`);
  }

  return response.json();
}
