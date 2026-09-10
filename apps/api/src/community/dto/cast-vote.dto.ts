import { IsIn, IsUUID } from 'class-validator';

const VOTABLE_TYPES = ['post', 'comment'] as const;

export class CastVoteDto {
  @IsIn(VOTABLE_TYPES)
  votableType!: (typeof VOTABLE_TYPES)[number];

  @IsUUID()
  votableId!: string;

  /** 0 clears an existing vote — see VotesService.cast. */
  @IsIn([1, -1, 0])
  value!: 1 | -1 | 0;
}
