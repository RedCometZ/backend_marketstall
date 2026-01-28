import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { jwtConstants } from './contants';
import { JwtService } from '@nestjs/jwt';
import moment from 'moment';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly _user: Repository<User>,
    private _jwt: JwtService,
  ) { }

  async create(body: CreateUserDto) {
    console.log("🚀 ~ UserService ~ create ~ body:", body)

    try {

      const existingUser = await this._user.findOne({
        where: {
          username: body.username,
        }
      })

      if (existingUser) {
        return {
          message: 'User already exists',
          status: 'error',
        }
      }

      const existingTel = await this._user.findOne({
        where: {
          tel: body.tel,
        }
      })

      if (existingTel) {
        return {
          message: 'Tel already exists',
          status: 'error',
        }
      }

      const hashTel = await bcrypt.hash(body.tel, 10);

      const userbody = {
        username: body.username,
        tel: body.tel,
      }

      const user = this._user.create(userbody);

      await this._user.save(user);

      return {
        status: 'success',
        data: user,
      }


    } catch (error) {

      console.log(error);
      return {
        message: error.message,
        status: error.status,
      }
    }
  }

  // async login(loginUserDto: LoginUserDto) {
  //   console.log("Login attempt:", loginUserDto);
  //   try {
  //     const user = await this._user.findOne({
  //       where: {
  //         tel: loginUserDto.tel,
  //         username: loginUserDto.username,
  //       }
  //     })
  //     if (!user) {
  //       throw new Error('User not found');
  //     }

  //     return user
  //   } catch (error) {
  //     console.log(error);
  //     return {
  //       message: error.message,
  //       status: error.status,
  //     }
  //   }
  // }
  async login(body: { username: string, tel: string }) {
    console.log('login attempt:: ', body);
    try {
      if (!body.username || !body.tel) return { status: "require" };

      let one = await this._user.findOne({
        where: {
          username: body.username,
        }
      });

      if (!one) {
        return { status: "username_not_found", message: "username is not found" };
      }

      console.log('User found, stored tel:', one.tel);
      console.log('Input tel:', body.tel);

      const isTelHashed = one.tel.startsWith('$2');

      let isMatch: boolean;
      if (isTelHashed) {
        isMatch = await bcrypt.compare(body.tel, one.tel);
      } else {
        isMatch = body.tel === one.tel;
      }

      if (!isMatch) {
        return { status: "tel_not_match", message: "tel is not correct" };
      }

      const userData = {
        id: one.id,
        username: one.username,
        tel: one.tel,
      };
      const expiresIn = "1h";
      let token = await this._jwt.signAsync(userData, { expiresIn });
      const expirationTime = moment().add(1, "hour").toDate();

      return {
        status: "success",
        data: userData,
        token: token,
        expires_at: expirationTime,
      };

    } catch (err) {
      console.error('Login error:', err);
      return {
        status: 'error',
        message: err.message
      }
    }
  }

  async checkToken(token: string) {
    // console.log('checkToken:: ', token);
    try {
      // 
      if (!token) {
        return { status: "error", message: "Token is required" };
      }

      const VERIFY = await this._jwt.verifyAsync(token, {
        secret: jwtConstants.secret,
      });
      // console.log("🚀 ~ AdminService ~ checkToken ~ VERIFY:", VERIFY)

      if (VERIFY) {
        // const ONE = await this._admin.findOne({
        //   where: { admin_id: VERIFY.admin_id },
        //   relations: {
        //     roles: {
        //       rules: {
        //       },
        //     }
        //   }
        // });

        const ONE = VERIFY;
        //
        // 
        const expiresIn = moment.unix(VERIFY.exp).diff(moment(), "seconds");

        return {
          status: "success",
          data: ONE,
          expires_in: expiresIn,
          expires_at: moment.unix(VERIFY.exp).toDate(),
        };
      } else return { status: "error" };
    } catch (e) {
      return { status: "error" };
    }
  }

  async refreshToken(token: string) {
    try {
      const VERIFY = await this._jwt.verifyAsync(token, {
        secret: jwtConstants.secret,
      });

      if (VERIFY) {
        // let ONE = await this._admin.findOne({
        //   where: { admin_id: VERIFY.id },
        // });
        let ONE = VERIFY;
        //
        // 
        const expiresIn = "1h";
        const payload = { id: ONE?.admin_id, username: ONE?.username };
        let newToken = await this._jwt.signAsync(ONE, { expiresIn });
        const expirationTime = moment().add(1, "hour").toDate();
        return {
          status: "success",
          user: payload,
          token: newToken,
          expires_at: expirationTime,
        };
      } else return { status: "error" };
    } catch (e) {


      return { status: "error" };
    }
  }

  async getOperators() {
    // console.log('get operators:: ');
    try {
      const operators = await this._user.find()

      // console.log('operators:: ', operators);

      return { status: "success", data: operators };

    } catch (err) {
      return { status: "error", message: err.message };
    }
  }

  async findAll() {
    try {

      const users = await this._user.find()

      return {
        status: 'success',
        data: users,
      }

    } catch (error) {
      console.log(error);
      return {
        message: error.message,
        status: error.status,
      }
    }

  }

  findOne(id: number) {
    return `This action returns a #${id} user`;
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    try {
      const result = await this._user.update(id, updateUserDto);
      if (result.affected === 0) {
        return { status: 'error', message: 'User not found' };
      }
      return { status: 'success', message: 'User updated successfully', data: result };
    } catch (error) {
      return { status: 'error', message: error.message };
    }
  }

  async remove(id: number) {
    try {
      const result = await this._user.delete(id);
      if (result.affected === 0) {
        return {
          status: 'error',
          message: 'User not found',
        };
      }
      return {
        status: 'success',
        message: 'User deleted successfully',
      };
    } catch (error) {
      console.log(error);
      return {
        status: 'error',
        message: error.message,
      };
    }
  }

  async findBookingByUser(userId: number) {
    console.log("🚀 ~ UserService ~ findOrderByUser ~ userId:", userId)

    try {
      const booking = await this._user.findOne({
        where: {
          id: userId
        },
        relations: {
          bookings: true
        }
      })

      return {
        status: 'success',
        data: booking
      }

    } catch (error) {
      return {
        status: 'error',
        message: error.message,
      }
    }
  }
}
