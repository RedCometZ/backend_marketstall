import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import moment from 'moment';
import { Admin } from './entities/admin.entity';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { jwtConstants } from '../user/contants';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Admin)
    private readonly adminRepository: Repository<Admin>,
    private readonly jwtService: JwtService,
  ) { }

  async create(createAdminDto: CreateAdminDto) {
    const { username, password } = createAdminDto;

    // Check if user exists
    const existing = await this.adminRepository.findOne({ where: { username } });
    if (existing) {
      return { status: 'error', message: 'Username already exists' };
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    const newAdmin = this.adminRepository.create({
      username,
      password: hashedPassword,
    });

    await this.adminRepository.save(newAdmin);
    return { status: 'success', data: newAdmin };
  }

  async login(body: { username: string; password: string }) {
    console.log('Admin login attempt:', body.username);

    const admin = await this.adminRepository.findOne({
      where: { username: body.username },
    });

    console.log('🔍 Admin found in DB:', admin ? 'YES' : 'NO');
    if (admin) {
      console.log('👤 Admin ID:', admin.id);
      console.log('🔑 Stored Password:', admin.password);
    }

    if (!admin) {
      throw new NotFoundException('User not found');
    }

    if (admin.isActive === false) {
      throw new UnauthorizedException('Account is disabled');
    }

    const isMatch = await bcrypt.compare(body.password, admin.password);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = {
      id: admin.id,
      username: admin.username,
      role: 'admin',
    };

    const token = await this.jwtService.signAsync(payload, {
      expiresIn: '1h',
      secret: jwtConstants.secret,
    });

    return {
      token,
      data: payload,
    };
  }

  async checkToken(token: string) {
    try {
      if (!token) return { status: 'error', message: 'Token is required' };

      const verify = await this.jwtService.verifyAsync(token, {
        secret: jwtConstants.secret,
      });

      if (verify) {
        // Optionally refresh lookup from DB to ensure user wasn't deleted
        const admin = await this.findOne(verify.id);
        if (!admin || admin.isActive === false) return { status: 'error', message: 'Account is disabled' };

        const expiresIn = moment.unix(verify.exp).diff(moment(), 'seconds');
        return {
          status: 'success',
          data: verify,
          expires_in: expiresIn,
          expires_at: moment.unix(verify.exp).toDate(),
        };
      }
      return { status: 'error' };
    } catch (e) {
      return { status: 'error', message: e.message };
    }
  }

  async refreshToken(token: string) {
    try {
      const verify = await this.jwtService.verifyAsync(token, {
        secret: jwtConstants.secret,
      });

      if (verify) {
        const admin = await this.findOne(verify.id);
        if (!admin || admin.isActive === false) return { status: 'error', message: 'Account is disabled' };

        const payload = { id: verify.id, username: verify.username, role: 'admin' };
        const expiresIn = '1h';
        const newToken = await this.jwtService.signAsync(payload, {
          secret: jwtConstants.secret,
          expiresIn
        });
        const expirationTime = moment().add(1, 'hour').toDate();

        return {
          status: 'success',
          user: payload,
          token: newToken,
          expires_at: expirationTime,
        };
      }
      return { status: 'error' };
    } catch (e) {
      return { status: 'error', message: e.message };
    }
  }

  findAll() {
    return this.adminRepository.find();
  }

  findOne(id: number) {
    return this.adminRepository.findOne({ where: { id } });
  }

  async update(id: number, updateAdminDto: UpdateAdminDto) {
    console.log(`Admin update called for ID: ${id}. Password provided: ${!!updateAdminDto.password}`);

    if (updateAdminDto.password) {
      console.log('Hashing new password...');
      updateAdminDto.password = await bcrypt.hash(updateAdminDto.password, 10);
      console.log('Password hashed successfully.');
    }
    return this.adminRepository.update(id, updateAdminDto);
  }

  remove(id: number) {
    return this.adminRepository.delete(id);
  }
}
