import { PartialType } from '@nestjs/mapped-types';
import { CreateBookingDto } from '../dto/create-booking.dto';

export class UpdateBookingDto extends PartialType(CreateBookingDto) { }
