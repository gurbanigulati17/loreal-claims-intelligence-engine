import { useState } from 'react';
import {
  assessClaim,
  type AssessmentResult,
  type AssessClaimPayload,
} from '../api/claims';
import './ClaimAssessmentForm.css';

const SAMPLE: AssessClaimPayload = {
  title: 'Anti-wrinkle serum — 4 week study',
  claimText: 'Reduces wrinkles by 20% in 4 weeks',
  productFormula:
    'Aqua, Glycerin, Retinol 0.3%, Niacinamide 5%, Hyaluronic Acid, Peptide complex',
  scientistName: 'Dr. Marie Dupont',
  evidence: `Double-blind randomized study, n=62 women aged 45-60, 4-week daily application.
Primary endpoint: clinical grading of crow's feet wrinkles (expert panel).
Results: 19.4% mean reduction vs baseline (p < 0.01). Placebo group: 3.1% (p=0.42).
No serious adverse events. 94% self-reported smoother skin.`,
};

export function ClaimAssessmentForm() {
  const [form, setForm] = useState<AssessClaimPayload>(SAMPLE);
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update =
    (field: keyof AssessClaimPayload) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
    };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await assessClaim(form);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assessment failed');
    } finally {
      setLoading(false);
    }
  };

  const confidencePercent = result
    ? Math.round(result.assessment.confidenceScore * 100)
    : 0;

  return (
    <div className="claims-app">
      <header className="claims-header">
        <p className="eyebrow">L&apos;Oréal R&amp;I</p>
        <h1>Claims Intelligence Engine</h1>
        <p className="subtitle">
          Submit a product claim and clinical evidence for AI-assisted
          justification review.
        </p>
      </header>

      <div className="claims-layout">
        <form className="claims-form" onSubmit={handleSubmit}>
          <label>
            Study title
            <input
              value={form.title}
              onChange={update('title')}
              required
            />
          </label>

          <label>
            Marketing claim
            <input
              value={form.claimText}
              onChange={update('claimText')}
              required
            />
          </label>

          <label>
            Product formula
            <textarea
              value={form.productFormula ?? ''}
              onChange={update('productFormula')}
              rows={3}
            />
          </label>

          <label>
            Scientist
            <input
              value={form.scientistName ?? ''}
              onChange={update('scientistName')}
            />
          </label>

          <label>
            Clinical study evidence
            <textarea
              value={form.evidence}
              onChange={update('evidence')}
              rows={8}
              required
            />
          </label>

          <button type="submit" disabled={loading}>
            {loading ? 'Assessing…' : 'Assess claim justification'}
          </button>
        </form>

        <section className="claims-result" aria-live="polite">
          <h2>Assessment result</h2>

          {!result && !error && !loading && (
            <p className="placeholder">
              Results will appear here after submission.
            </p>
          )}

          {loading && <p className="loading">Running LLM assessment…</p>}

          {error && <p className="error">{error}</p>}

          {result && (
            <div className="result-card">
              <div
                className={`verdict ${result.assessment.justified ? 'yes' : 'no'}`}
              >
                <span className="label">Justified</span>
                <strong>{result.assessment.justified ? 'Yes' : 'No'}</strong>
              </div>

              <div className="metric">
                <span className="label">Confidence score</span>
                <div className="score-bar">
                  <div
                    className="score-fill"
                    style={{ width: `${confidencePercent}%` }}
                  />
                </div>
                <strong>{confidencePercent}%</strong>
              </div>

              <div className="reasoning">
                <span className="label">Reasoning</span>
                <p>{result.assessment.reasoning}</p>
              </div>

              <footer className="meta">
                <span>Claim ID: {result.claim.id}</span>
                <span>Model: {result.assessment.modelUsed}</span>
                <span>Status: {result.claim.status}</span>
              </footer>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
