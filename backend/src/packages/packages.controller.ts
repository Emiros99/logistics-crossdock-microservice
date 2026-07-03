import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ScanPackageDto } from './dto/scan-package.dto';
import {
  PackageView,
  PackageWithHistoryView,
} from './dto/package-response.dto';
import { PackagesService } from './packages.service';

/**
 * A publikus HTTP-szerződés (globális prefix: /api -> /api/packages/...).
 * A kontroller vékony: validál (DTO + ValidationPipe) és delegál a service-nek (SRP).
 */
@Controller('packages')
export class PackagesController {
  constructor(private readonly packagesService: PackagesService) {}

  /**
   * POST /api/packages/scan
   * Sikeres léptetés -> 200 OK a csomag nézetével.
   * Üres/hibás body -> 400 (ValidationPipe). DISPATCHED újraszkennelés -> 409 (service).
   *
   * Szigorúbb rate limit: a scan írási művelet; kapunkénti burst ellen felső korlát.
   */
  @Post('scan')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 1000 } })
  scan(@Body() dto: ScanPackageDto): Promise<PackageView> {
    return this.packagesService.scan(dto);
  }

  /**
   * GET /api/packages/:trackingNumber
   * -> { package, history }. 404 ha nincs ilyen csomag.
   */
  @Get(':trackingNumber')
  findOne(
    @Param('trackingNumber') trackingNumber: string,
  ): Promise<PackageWithHistoryView> {
    return this.packagesService.findByTrackingNumber(trackingNumber);
  }
}
