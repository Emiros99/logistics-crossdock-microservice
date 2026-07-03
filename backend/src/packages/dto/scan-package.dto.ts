import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * A POST /api/packages/scan bemeneti szerződése.
 * A validáció a kontrollernél (ValidationPipe) fut le -> a rossz input
 * adatbázisig sem jut (400 Bad Request). Ez a védelem első rétege.
 *
 * `whitelist: true` (globális pipe) -> ismeretlen mezők lehullnak;
 * a MaxLength egy egyszerű DoS/túlcímkézés elleni felső korlát.
 */
export class ScanPackageDto {
  @IsString()
  @IsNotEmpty({ message: 'trackingNumber must not be empty' })
  @MaxLength(128)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  trackingNumber!: string;

  @IsString()
  @IsNotEmpty({ message: 'location must not be empty' })
  @MaxLength(256)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  location!: string;
}
