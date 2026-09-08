import { IsString, MaxLength, MinLength } from 'class-validator';

export class ClassifyTextDto {
  @IsString()
  @MinLength(1)
  @MaxLength(3000)
  text!: string;
}
