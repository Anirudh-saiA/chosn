import { IsIn } from 'class-validator';

export class CastPollVoteDto {
  @IsIn(['cop', 'drop'])
  choice!: 'cop' | 'drop';
}
