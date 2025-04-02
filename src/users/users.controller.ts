import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateUserDto } from './create-user.dto';
import { UserPaginator } from './user.paginator.dto';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

@Controller('users')
export class UsersController {
  
  @Get()
  async getUsers(@Query() params: UserPaginator) {
    try {
      const filterOptions: Prisma.UserWhereInput = { deleted: false };
      const { name, id, mail, username, active, root, page, perPage, sortBy, sortByProperty } = params;

      if (name) {
        filterOptions.OR = [
          { name: { contains: name, mode: 'insensitive' } },
          { last_name: { contains: name, mode: 'insensitive' } },
        ];
      }
      if (id) filterOptions.id_visible = id;
      if (mail) filterOptions.mail = { contains: mail };
      if (username) filterOptions.username = { contains: username };
      if (active !== undefined) filterOptions.active = active;
      if (root) filterOptions.root = root;

      const totalUsers = await prisma.user.count({ where: filterOptions });
      const lastPage = perPage ? Math.ceil(totalUsers / perPage) : 1;

      const users = await prisma.user.findMany({
        where: filterOptions,
        skip: page && perPage ? (page - 1) * perPage : undefined,
        take: perPage,
        orderBy: sortBy ? { [sortByProperty || 'id']: sortBy } : undefined,
        include: {
          userCity: {
            where: { city: { active: true, deleted: false } },
            include: { city: true },
          },
        },
      });

      return {
        data: users,
        metadata: page && perPage ? { page, totalUsers, lastPage } : { totalUsers },
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Get(':id')
  async getUserById(@Param('id', ParseUUIDPipe) id: string) {
    try {
      const user = await prisma.user.findFirst({
        where: { id },
        include: {
          userCity: {
            where: { city: { active: true, deleted: false } },
            include: { city: true },
          },
        },
      });

      if (!user) throw new NotFoundException('User not found');
      return user;
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Patch(':id')
  async updateUser(@Param('id') id: string, @Body() updateData: Partial<CreateUserDto>) {
    try {
      const user = await prisma.user.findFirst({ where: { id } });
      if (!user) throw new NotFoundException('User not found');

      if (updateData.old_password) {
        const isPasswordValid = bcrypt.compareSync(updateData.old_password, user.password);
        if (!isPasswordValid) throw new UnauthorizedException('Wrong password');

        updateData.password = bcrypt.hashSync(updateData.password, 12);
      }

      const { deletedCityID = [], updateCityID = [], ...updateFields } = updateData;

      const updatedUser = await prisma.user.update({
        where: { id },
        data: {
          ...updateFields,
          userCity: {
            create: updateCityID.length ? updateCityID.map(cityID => ({ cityID })) : undefined,
            deleteMany: deletedCityID.length ? deletedCityID.map(cityID => ({ cityID })) : undefined,
          },
        },
        include: {
          userCity: {
            where: { city: { active: true, deleted: false } },
            include: { city: true },
          },
        },
      });

      const { password, ...userWithoutPassword } = updatedUser;
      return userWithoutPassword;
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Delete(':id')
  async deleteUser(@Param('id') id: string) {
    try {
      await this.getUserById(id);
      const deletedUser = await this.updateUser(id, { deleted: true, deleteDate: new Date() });
      if (!deletedUser) throw new BadRequestException('Deletion failed');
      return `User removed`;
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
}
