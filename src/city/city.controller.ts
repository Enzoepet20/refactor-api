import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { CreateCityDto } from './create-city.dto';
import { CityPaginatorDto } from './city-paginator.dto';
import { Owner } from '@/common/decorators/user.decorator';
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

@Controller('city')
export class CityController {
  // Método para crear una ciudad
  @Post()
  async create(@Body() cityData: CreateCityDto, @Owner() user: any) {
    try {
      const totalCities = await prisma.city.count();
      return await prisma.city.create({
        data: {
          id_visible: totalCities + 1,
          ...cityData,
          uploadUserID: user.id,
        },
        include: {
          uploadUser: {
            select: { name: true, last_name: true, id: true, username: true },
          },
        },
      });
    } catch (error) {
      throw error;
    }
  }

  // Método para obtener ciudades con filtros y paginación
  @Get()
  async findAll(@Query() query: CityPaginatorDto) {
    try {
      const { id, active, page, perPage, sortBy, sortByProperty } = query;
      const filter: Prisma.CityWhereInput = { deleted: false };

      if (id) filter.id = id;
      if (active !== undefined) filter.active = active;

      const totalRecords = await prisma.city.count({ where: filter });
      const lastPage = perPage ? Math.ceil(totalRecords / perPage) : 1;

      const cities = await prisma.city.findMany({
        where: filter,
        skip: page && perPage ? (page - 1) * perPage : undefined,
        take: page && perPage ? perPage : undefined,
        orderBy: sortBy
          ? { [sortByProperty || 'id_visible']: sortBy }
          : undefined,
        include: {
          uploadUser: {
            select: { name: true, last_name: true, id: true, username: true },
          },
        },
      });

      const metadata = page && perPage
        ? { page, totalRecords, lastPage }
        : { totalRecords };

      return { data: cities, metadata };
    } catch (error) {
      throw error;
    }
  }

  // Método para obtener una ciudad por su id
  @Get(':id')
  async findOne(@Param('id') cityId: string) {
    try {
      return await prisma.city.findFirst({
        where: { id: cityId },
        include: {
          uploadUser: {
            select: { name: true, last_name: true, id: true, username: true },
          },
        },
      });
    } catch (error) {
      throw error;
    }
  }

  // Método para actualizar una ciudad
  @Patch(':id')
  async update(@Param('id') cityId: string, @Body() cityData: Partial<CreateCityDto>) {
    try {
      return await prisma.city.update({
        data: { ...cityData },
        where: { id: cityId },
        include: {
          uploadUser: {
            select: { name: true, last_name: true, id: true, username: true },
          },
        },
      });
    } catch (error) {
      throw error;
    }
  }

  // Método para marcar una ciudad como eliminada (soft delete)
  @Delete(':id')
  async remove(@Param('id') cityId: string) {
    try {
      await this.update(cityId, { deleted: true, deletedAt: new Date() });
      return { message: `City #${cityId} marked as deleted` };
    } catch (error) {
      throw error;
    }
  }
}
