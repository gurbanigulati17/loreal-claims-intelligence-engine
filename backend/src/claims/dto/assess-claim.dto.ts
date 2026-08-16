import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

const CLAIM_TYPES = [
  'EFFICACY',
  'SAFETY',
  'SENSORY',
  'SUSTAINABILITY',
  'OTHER',
] as const;

export class AssessClaimDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(200)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(2000)
  claimText: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(20)
  evidence: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  productFormula?: string;

  @IsOptional()
  @IsIn(CLAIM_TYPES)
  claimType?: (typeof CLAIM_TYPES)[number];

  @IsOptional()
  @IsString()
  scientistId?: string;

  @IsOptional()
  @IsString()
  scientistName?: string;

  @IsOptional()
  @IsString()
  evaluatorId?: string;
}
