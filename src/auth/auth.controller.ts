import { PublicRoute } from '@/common/decorators/public.decorator';
import { Owner } from '@/common/decorators/user.decorator';
import { CreateUserDto } from '@/users/create-user.dto';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { IsString } from 'class-validator';

export class LoginDto {
  @IsString()
  username: string;
  @IsString()
  password: string;
}

const prisma = new PrismaClient();

@Controller('auth')
export class AuthController implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('AUTH');

  constructor(private readonly jwt: JwtService) {}

  async onModuleInit() {
    await prisma.$connect();
    try {
      const rootUser = await prisma.user.findFirst({
        where: { OR: [{ username: 'admin' }, { mail: 'admin@admin.com' }] },
      });
      if (!rootUser) {
        const newRoot = {
          username: 'admin',
          mail: 'admin@admin.com',
          password: bcrypt.hashSync('contraseña#admin2024', 12),
          root: true,
        };
        await prisma.user.create({ data: newRoot });
        this.logger.log('ROOT USER CREATED');
      } else {
        this.logger.log('ROOT USER ALREADY EXISTS');
      }
    } catch (err) {
      this.logger.error(JSON.stringify(err));
    }
  }

  async onModuleDestroy() {
    await prisma.$disconnect();
  }

  // Método para verificar un token
  @Post('check')
  checkToken(@Body('token') token: string) {
    try {
      const payload = this.jwt.verify(token);
      return payload ? true : false;
    } catch (error) {
      return false;
    }
  }

  // Método para iniciar sesión
  @Post('login')
  @PublicRoute()
  async login(@Body() credentials: LoginDto) {
    try {
      if (!credentials.username || !credentials.password) {
        throw new UnauthorizedException('Missing credentials');
      }

      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { username: credentials.username },
            { mail: credentials.username },
          ],
        },
        include: {
          userCity: {
            where: { city: { active: true, deleted: false } },
            include: { city: true },
          },
        },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      const validPassword = bcrypt.compareSync(credentials.password, user.password);
      if (!validPassword) {
        throw new UnauthorizedException('Wrong credentials');
      }

      const { id, username, otp } = user;
      const token = this.jwt.sign({ sub: id, username, otp });
      const { password, ...userWithoutPassword } = user;
      return { user: userWithoutPassword, token };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  // Método para registrar un nuevo usuario
  @Post('register')
  async register(@Body() userData: CreateUserDto, @Owner() owner: any) {
    try {
      const newUser = {
        ...userData,
        id_user: owner.id,
        password: bcrypt.hashSync(userData.password, 12),
      };

      const createdUser = await prisma.user.create({
        data: {
          ...newUser,
          userCity: {
            create: userData.updateCityID && userData.updateCityID.length > 0
              ? userData.updateCityID.map((cityID) => ({ cityID }))
              : undefined,
          },
        },
      });

      const { password, ...userWithoutPassword } = createdUser;
      return userWithoutPassword;
    } catch (err) {
      this.logger.error(err);
      throw new BadRequestException(err);
    }
  }

  // Método para obtener información del usuario autenticado
  @Get('info')
  getUserInfo(@Owner() user: any) {
    return user;
  }
}
