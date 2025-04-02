import { Owner } from '@/common/decorators/user.decorator';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateNeighborhoodDto } from './create-neighborhood.dto';
import { NeighborhoodPaginatorDto } from './neighborhood-paginator.dto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

@Controller('neighborhood')
export class NeighborhoodController {

  @Post()
  async createNeighborhood(@Body() data: CreateNeighborhoodDto, @Owner() user) {
    try {
      const totalNeighborhoods = await prisma.neighborhood.count();
      return await prisma.neighborhood.create({
        data: {
          id_visible: totalNeighborhoods + 1,
          ...data,
          uploadUserID: user?.id,
        },
        include: { uploadUser: true, city: true },
      });
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Get()
  async getNeighborhoods(@Query() params: NeighborhoodPaginatorDto) {
    try {
      const filter: Prisma.NeighborhoodWhereInput = { deleted: false };
      const { id, name, active, page, perPage, sortBy, sortByProperty } = params;

      if (id) filter.id = id;
      if (name) filter.name = { contains: name, mode: 'insensitive' };
      if (active !== undefined) filter.active = active;

      const totalNeighborhoods = await prisma.neighborhood.count({ where: filter });
      const lastPage = perPage ? Math.ceil(totalNeighborhoods / perPage) : 1;

      const neighborhoods = await prisma.neighborhood.findMany({
        where: filter,
        skip: page && perPage ? (page - 1) * perPage : undefined,
        take: perPage,
        orderBy: sortBy ? { [sortByProperty || 'id_visible']: sortBy } : undefined,
        include: { uploadUser: true, city: true },
      });

      return {
        data: neighborhoods,
        metadata: page && perPage ? { page, totalNeighborhoods, lastPage } : { totalNeighborhoods },
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
}
