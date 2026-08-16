import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
const ClaimStatus = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;
import OpenAI from 'openai';
import { PrismaService } from '../prisma/prisma.service';
import { AssessClaimDto } from './dto/assess-claim.dto';

export interface LlmAssessmentResult {
  justified: boolean;
  confidenceScore: number;
  reasoning: string;
}

@Injectable()
export class ClaimsService {
  private readonly logger = new Logger(ClaimsService.name);
  private readonly openai: OpenAI | null;
  private readonly model: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    this.model = this.config.get<string>('OPENAI_MODEL') ?? 'gpt-4o-mini';
    this.openai = apiKey ? new OpenAI({ apiKey }) : null;
  }

  async assess(dto: AssessClaimDto) {
    const claim = await this.prisma.claim.create({
      data: {
        title: dto.title,
        claimText: dto.claimText,
        claimType: dto.claimType,
        productFormula: dto.productFormula,
        scientistId: dto.scientistId,
        scientistName: dto.scientistName,
        status: ClaimStatus.UNDER_REVIEW,
      },
    });

    const llmResult = await this.evaluateWithLlm(dto);

    const assessment = await this.prisma.assessment.create({
      data: {
        claimId: claim.id,
        evidence: dto.evidence,
        justified: llmResult.justified,
        confidenceScore: llmResult.confidenceScore,
        reasoning: llmResult.reasoning,
        modelUsed: this.openai ? this.model : 'mock-evaluator-v1',
        evaluatorId: dto.evaluatorId,
      },
    });

    const updatedClaim = await this.prisma.claim.update({
      where: { id: claim.id },
      data: {
        status: llmResult.justified
          ? ClaimStatus.APPROVED
          : ClaimStatus.REJECTED,
      },
    });

    return {
      claim: updatedClaim,
      assessment,
    };
  }

  async findAll() {
    return this.prisma.claim.findMany({
      include: {
        assessments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.claim.findUnique({
      where: { id },
      include: {
        assessments: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  private async evaluateWithLlm(
    dto: AssessClaimDto,
  ): Promise<LlmAssessmentResult> {
    if (!this.openai) {
      this.logger.warn(
        'OPENAI_API_KEY not set — using deterministic mock assessment',
      );
      return this.mockAssessment(dto);
    }

    const systemPrompt = `You are a regulatory and clinical claims evaluator for L'Oréal R&I.
Your job is to determine whether clinical study evidence supports a marketing claim.

Evaluate strictly on:
- Statistical significance and sample size
- Study design quality (controls, blinding, duration)
- Alignment between measured endpoints and the claim wording
- Magnitude of effect vs. claimed percentage/outcome
- Regulatory plausibility for cosmetics vs. drug claims

Respond ONLY with valid JSON in this exact shape:
{
  "justified": boolean,
  "confidenceScore": number between 0 and 1,
  "reasoning": "2-4 sentence explanation"
}`;

    const userPrompt = `CLAIM:
${dto.claimText}

PRODUCT FORMULA (if provided):
${dto.productFormula ?? 'Not provided'}

CLINICAL STUDY EVIDENCE:
${dto.evidence}`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: this.model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from OpenAI');
      }

      const parsed = JSON.parse(content) as LlmAssessmentResult;
      return {
        justified: Boolean(parsed.justified),
        confidenceScore: this.clampScore(parsed.confidenceScore),
        reasoning: String(parsed.reasoning ?? 'No reasoning provided.'),
      };
    } catch (error) {
      this.logger.error('OpenAI assessment failed, falling back to mock', error);
      return this.mockAssessment(dto);
    }
  }

  private mockAssessment(dto: AssessClaimDto): LlmAssessmentResult {
    const evidence = dto.evidence.toLowerCase();

    const hasStats =
      evidence.includes('p <') ||
      evidence.includes('p=') ||
      evidence.includes('statistically significant');
    const hasSample = /\b(n\s*=\s*\d+|participants|subjects)\b/i.test(
      dto.evidence,
    );
    const hasPercent = /\d+\s*%/.test(dto.claimText);
    const evidenceMentionsPercent = /\d+\s*%/.test(dto.evidence);
    const aligned =
      !hasPercent || evidenceMentionsPercent || evidence.includes('wrinkle');

    const justified = hasStats && hasSample && aligned;
    const confidenceScore = justified
      ? hasStats && evidenceMentionsPercent
        ? 0.82
        : 0.68
      : 0.35;

    const reasoning = justified
      ? 'Mock evaluation: evidence includes statistical significance and sample size, and appears directionally aligned with the claim. Configure OPENAI_API_KEY for full LLM analysis.'
      : 'Mock evaluation: evidence lacks sufficient statistical support, sample description, or alignment with the claimed outcome. Configure OPENAI_API_KEY for full LLM analysis.';

    return {
      justified,
      confidenceScore,
      reasoning,
    };
  }

  private clampScore(score: number): number {
    if (Number.isNaN(score)) return 0;
    return Math.min(1, Math.max(0, score));
  }
}
