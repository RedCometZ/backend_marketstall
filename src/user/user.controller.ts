import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { UserService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginUserDto } from './dto/login-user.dto';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) { }

  @Post('create')
  create(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);

  }

  // @Post('login')
  // login(@Body() loginUserDto: LoginUserDto) {
  //   return this.userService.login(loginUserDto);

  // }

  @Post('login')
  login(@Body() body: { username: string, tel: string }) {
    return this.userService.login(body);

  }


  @Get('all')
  findAll() {
    return this.userService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userService.findOne(+id);
  }

  @Get('booking/:id')
  findBookingByUser(@Param('id') id: string) {
    return this.userService.findBookingByUser(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.update(+id, updateUserDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.userService.remove(+id);
  }

  @Post('check-token')
  checkToken(@Body() body: { token: string }) {
    return this.userService.checkToken(body.token);
  }

  @Post('refresh-token')
  refreshToken(@Body() body: { token: string }) {
    return this.userService.refreshToken(body.token);
  }
}
